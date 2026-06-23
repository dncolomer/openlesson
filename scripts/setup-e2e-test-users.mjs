#!/usr/bin/env node
/**
 * Create or update dedicated E2E test users on the configured Supabase project.
 *
 * Requires:
 *   cp .env.e2e.example .env.e2e
 *   ALLOW_PROD_E2E=1
 *   E2E_REGULAR_EMAIL / PASSWORD, E2E_TEAMS_EMAIL / PASSWORD
 *
 * Usage:
 *   node scripts/setup-e2e-test-users.mjs
 */

import { readFileSync, writeFileSync, existsSync } from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const line of readFileSync(path, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    out[key] = value;
  }
  return out;
}

function upsertEnvValue(path, key, value) {
  const lines = existsSync(path) ? readFileSync(path, "utf8").split("\n") : [];
  let found = false;
  const next = lines.map((line) => {
    if (line.startsWith(`${key}=`)) {
      found = true;
      return `${key}=${value}`;
    }
    return line;
  });
  if (!found) next.push(`${key}=${value}`);
  writeFileSync(path, next.filter((l, i, arr) => !(i === arr.length - 1 && l === "")).join("\n") + "\n");
}

function periodEnd(days = 30) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
}

async function ensureAuthUser(admin, email, password) {
  const { data: listed, error: listError } = await admin.auth.admin.listUsers({
    page: 1,
    perPage: 1000,
  });
  if (listError) throw listError;

  const existing = listed.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase()
  );
  if (existing) {
    await admin.auth.admin.updateUserById(existing.id, {
      password,
      email_confirm: true,
      user_metadata: { e2e_test: true, label: email.includes("teams") ? "e2e-teams" : "e2e-regular" },
    });
    return existing.id;
  }

  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { e2e_test: true, label: email.includes("teams") ? "e2e-teams" : "e2e-regular" },
  });
  if (error || !data.user) throw error || new Error(`Failed to create ${email}`);
  return data.user.id;
}

async function ensureProfile(admin, userId, patch) {
  const { data: existing } = await admin.from("profiles").select("id").eq("id", userId).maybeSingle();
  if (!existing) {
    const { error } = await admin.from("profiles").insert({ id: userId, ...patch });
    if (error) throw error;
    return;
  }
  const { error } = await admin.from("profiles").update(patch).eq("id", userId);
  if (error) throw error;
}

async function ensureTeamsOrg(admin, userId) {
  const { data: profile } = await admin
    .from("profiles")
    .select("organization_id")
    .eq("id", userId)
    .single();

  if (profile?.organization_id) return profile.organization_id;

  const slug = `e2e-test-org-${userId.slice(0, 8)}`;
  const { data: org, error: orgError } = await admin
    .from("organizations")
    .insert({
      name: "[E2E] Test Organization",
      slug,
      metadata: { source: "e2e-setup", created_by: userId },
    })
    .select("id")
    .single();
  if (orgError || !org) throw orgError || new Error("Failed to create org");

  const { error: profileError } = await admin
    .from("profiles")
    .update({ organization_id: org.id, is_org_admin: true })
    .eq("id", userId);
  if (profileError) throw profileError;

  return org.id;
}

async function ensureTeamsApiKey(admin, userId, organizationId) {
  const label = "[E2E] Teams test key";
  const { data: existing } = await admin
    .from("agent_api_keys")
    .select("id, key_prefix")
    .eq("user_id", userId)
    .eq("label", label)
    .eq("is_active", true)
    .maybeSingle();

  if (existing) {
    return { id: existing.id, apiKey: null, reused: true, prefix: existing.key_prefix };
  }

  const rawKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
  const keyPrefix = rawKey.slice(0, 12);

  const { data: inserted, error } = await admin
    .from("agent_api_keys")
    .insert({
      user_id: userId,
      organization_id: organizationId,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label,
      scopes: ["*"],
      rate_limit: 120,
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !inserted) throw error || new Error("Failed to create API key");
  return { id: inserted.id, apiKey: rawKey, reused: false, prefix: keyPrefix };
}

async function main() {
  const rootEnv = loadEnvFile(".env.local");
  const e2eEnv = loadEnvFile(".env.e2e");
  const env = { ...rootEnv, ...e2eEnv, ...process.env };

  if (env.ALLOW_PROD_E2E !== "1") {
    console.error("Refusing to run: set ALLOW_PROD_E2E=1 in .env.e2e");
    process.exit(1);
  }

  const {
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    E2E_REGULAR_EMAIL,
    E2E_REGULAR_PASSWORD,
    E2E_TEAMS_EMAIL,
    E2E_TEAMS_PASSWORD,
  } = env;

  for (const [name, value] of Object.entries({
    NEXT_PUBLIC_SUPABASE_URL,
    SUPABASE_SERVICE_ROLE_KEY,
    E2E_REGULAR_EMAIL,
    E2E_REGULAR_PASSWORD,
    E2E_TEAMS_EMAIL,
    E2E_TEAMS_PASSWORD,
  })) {
    if (!value) {
      console.error(`Missing ${name}. Copy .env.e2e.example to .env.e2e and fill it in.`);
      process.exit(1);
    }
  }

  const host = NEXT_PUBLIC_SUPABASE_URL.replace(/^https?:\/\//, "").split("/")[0];
  console.log(`Setting up E2E users on ${host}\n`);

  const admin = createClient(NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const regularUserId = await ensureAuthUser(admin, E2E_REGULAR_EMAIL, E2E_REGULAR_PASSWORD);
  await ensureProfile(admin, regularUserId, {
    plan: "regular_2026",
    subscription_status: "active",
    current_period_end: periodEnd(),
    extra_lessons: 0,
    is_admin: false,
    organization_id: null,
    is_org_admin: false,
  });
  console.log(`✓ Regular user: ${E2E_REGULAR_EMAIL} (${regularUserId})`);

  const teamsUserId = await ensureAuthUser(admin, E2E_TEAMS_EMAIL, E2E_TEAMS_PASSWORD);
  const orgId = await ensureTeamsOrg(admin, teamsUserId);
  await ensureProfile(admin, teamsUserId, {
    plan: "pro_teams",
    subscription_status: "active",
    current_period_end: periodEnd(),
    extra_lessons: 0,
    is_admin: false,
    organization_id: orgId,
    is_org_admin: true,
  });
  console.log(`✓ Teams user: ${E2E_TEAMS_EMAIL} (${teamsUserId})`);
  console.log(`✓ Teams org: ${orgId}`);

  const keyResult = await ensureTeamsApiKey(admin, teamsUserId, orgId);
  if (keyResult.reused) {
    console.log(`! Teams API key already exists (${keyResult.prefix}…). Reusing; not printing secret.`);
    console.log("  Revoke the old key in dashboard and delete the row to mint a fresh one.");
  } else {
    console.log(`✓ Teams API key created: ${keyResult.apiKey}`);
    upsertEnvValue(".env.e2e", "E2E_TEAMS_API_KEY", keyResult.apiKey);
  }

  upsertEnvValue(".env.e2e", "E2E_REGULAR_USER_ID", regularUserId);
  upsertEnvValue(".env.e2e", "E2E_TEAMS_USER_ID", teamsUserId);
  upsertEnvValue(".env.e2e", "E2E_TEAMS_ORG_ID", orgId);

  console.log("\nSaved IDs to .env.e2e");
  console.log("Next: node scripts/run-tier-e2e-tests.mjs");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});