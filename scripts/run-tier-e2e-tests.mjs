#!/usr/bin/env node
/**
 * Tier-based E2E checks for Regular (web) and Teams (Agent API).
 *
 * Usage:
 *   node scripts/run-tier-e2e-tests.mjs
 *   E2E_ALLOW_LIVE_WRITES=1 node scripts/run-tier-e2e-tests.mjs   # includes xAI writes
 */

import { readFileSync, existsSync } from "node:fs";
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

const env = { ...loadEnvFile(".env.local"), ...loadEnvFile(".env.e2e"), ...process.env };
const baseUrl = env.E2E_BASE_URL || "http://127.0.0.1:3000";
const liveWrites = env.E2E_ALLOW_LIVE_WRITES === "1";
const results = [];

function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function section(title) {
  console.log(`\n== ${title} ==`);
}

async function checkProfiles(admin) {
  section("Profile / tier state");

  for (const [label, userId, expectedPlan] of [
    ["regular", env.E2E_REGULAR_USER_ID, "regular_2026"],
    ["teams", env.E2E_TEAMS_USER_ID, "pro_teams"],
  ]) {
    if (!userId) {
      fail(`${label}: user id`, "missing in .env.e2e — run setup-e2e-test-users.mjs first");
      continue;
    }
    const { data, error } = await admin
      .from("profiles")
      .select("plan, subscription_status, organization_id, is_org_admin, current_period_end")
      .eq("id", userId)
      .single();
    if (error || !data) {
      fail(`${label}: profile`, error?.message || "not found");
      continue;
    }
    if (data.plan !== expectedPlan || data.subscription_status !== "active") {
      fail(`${label}: tier`, `expected ${expectedPlan}/active, got ${data.plan}/${data.subscription_status}`);
    } else {
      pass(`${label}: tier`, `${data.plan} active`);
    }
    if (label === "teams") {
      if (!data.organization_id || !data.is_org_admin) {
        fail("teams: org admin", "organization_id or is_org_admin missing");
      } else {
        pass("teams: org admin", data.organization_id);
      }
    }
  }
}

async function checkSchema(admin) {
  section("Schema preflight");
  for (const column of ["organization_id", "guest_user_id"]) {
    const { error } = await admin.from("workspaces").select(`id, ${column}`).limit(1);
    if (error) fail(`workspaces.${column}`, error.message);
    else pass(`workspaces.${column}`, "present");
  }
}

async function agentJson(path, apiKey, init = {}) {
  const res = await fetch(`${baseUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
      ...(init.headers || {}),
    },
  });
  const text = await res.text();
  let body = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { res, body };
}

async function runTeamsAgentApiTests() {
  section("Teams — Agent API (automated)");

  const apiKey = env.E2E_TEAMS_API_KEY;
  if (!apiKey) {
    fail("teams api key", "missing E2E_TEAMS_API_KEY — rerun setup or create via POST /api/v2/agent/keys");
    return;
  }

  const unauthorized = await agentJson("/api/v2/agent/workspaces", "sk_invalid", {
    method: "POST",
    body: JSON.stringify({ initial_prompt: "noop" }),
  });
  if (unauthorized.res.status === 401) pass("teams: invalid key blocked", "401");
  else fail("teams: invalid key blocked", `got ${unauthorized.res.status}`);

  if (!liveWrites) {
    console.log("  (skipping live workspace/TAP writes — set E2E_ALLOW_LIVE_WRITES=1 to enable)");
    return;
  }

  const create = await agentJson("/api/v2/agent/workspaces", apiKey, {
    method: "POST",
    body: JSON.stringify({
      initial_prompt: "[E2E-TEST] Demonstrate basic recursion reasoning for a technical interview.",
    }),
  });
  if (create.res.status !== 201 || !create.body?.workspace?.id) {
    fail("teams: create workspace", `${create.res.status} ${JSON.stringify(create.body)}`);
    return;
  }
  const workspaceId = create.body.workspace.id;
  pass("teams: create workspace", workspaceId);

  const blocks = await agentJson(`/api/v2/agent/workspaces/${workspaceId}/blocks`, apiKey);
  if (blocks.res.status !== 200 || !blocks.body?.blocks?.length) {
    fail("teams: list blocks", `${blocks.res.status}`);
    return;
  }
  const blockId = blocks.body.blocks[0].id;
  pass("teams: list blocks", `${blocks.body.blocks.length} blocks`);

  const link = await agentJson(
    `/api/v2/agent/workspaces/${workspaceId}/blocks/${blockId}/tap-links`,
    apiKey,
    { method: "POST", body: JSON.stringify({ minutes: 15 }) }
  );
  if (link.res.status !== 201 || !link.body?.tap_link?.id) {
    fail("teams: create TAP link", `${link.res.status} ${JSON.stringify(link.body)}`);
    return;
  }
  pass("teams: create TAP link", link.body.tap_link.id);

  const list = await agentJson(`/api/v2/agent/workspaces/${workspaceId}/tap-links`, apiKey);
  if (list.res.status === 200) pass("teams: list TAP links", `${list.body?.tap_links?.length ?? 0} links`);
  else fail("teams: list TAP links", String(list.res.status));

  if (link.body?.private_url) {
    const token = link.body.private_url.split("/").pop();
    const page = await fetch(`${baseUrl}/tap/session/${token}`, { redirect: "manual" });
    if (page.status === 200) pass("teams: private TAP page loads", token.slice(0, 8) + "…");
    else fail("teams: private TAP page loads", String(page.status));
  }
}

function printManualRegularChecklist() {
  section("Regular — manual browser checklist");
  console.log(`Log in as ${env.E2E_REGULAR_EMAIL || "(regular test user)"} at ${baseUrl}/login\n`);
  const steps = [
    "Dashboard → Usage tab shows plan 'regular_2026' and proof-of-work limit 100",
    "Open /workspace/new and create workspace titled [E2E-REG] …",
    "Open the new workspace and confirm blocks render in the plan view",
    "Open /workspace/{id}/tap — verify setup UI loads (optional: run 2-min session only if accepting xAI cost)",
    "Confirm /api/check-usage shows allowed:true in Network tab after login",
    "Confirm pricing page does NOT offer Teams-only org features on this account",
  ];
  steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
}

function printManualTeamsChecklist() {
  section("Teams — manual browser checklist");
  console.log(`Log in as ${env.E2E_TEAMS_EMAIL || "(teams test user)"} at ${baseUrl}/login\n`);
  const steps = [
    "Dashboard → Usage shows 'pro_teams' and org block pool",
    "Organization page lists [E2E] Test Organization and guest section",
    "Create org guest via API or POST /api/v2/agent/org/guests (requires migration 045 guest columns)",
    "POST /api/v2/agent/keys works even if dashboard key UI still says Pro-only (known gap)",
    "Complete one private TAP session via bearer link in incognito (no login required)",
    "GET .../tap-links shows status=completed after TAP; score via POST .../performance",
  ];
  steps.forEach((step, i) => console.log(`${i + 1}. ${step}`));
}

async function main() {
  console.log("OpenLesson tier E2E tests");
  console.log(`Base URL: ${baseUrl}`);
  console.log(`Live writes: ${liveWrites ? "ON (xAI + DB)" : "OFF"}\n`);

  if (!env.NEXT_PUBLIC_SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase env from .env.local");
    process.exit(1);
  }

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  await checkSchema(admin);
  await checkProfiles(admin);
  await runTeamsAgentApiTests();
  printManualRegularChecklist();
  printManualTeamsChecklist();

  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  console.log(`Automated checks: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}`);
  if (failed.length) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});