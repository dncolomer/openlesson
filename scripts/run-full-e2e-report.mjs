#!/usr/bin/env node
/**
 * Full E2E report: tier checks + Agent API v2 (live writes, no deletes).
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
const report = [];

function record(area, name, ok, detail = "", meta = {}) {
  report.push({ area, name, ok, detail, ...meta });
  const mark = ok ? "PASS" : "FAIL";
  console.log(`[${mark}] ${area} — ${name}${detail ? `: ${detail}` : ""}`);
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

async function main() {
  console.log(`Full E2E report | ${baseUrl} | live writes: ${liveWrites ? "ON" : "OFF"}\n`);

  const admin = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const anon = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // --- Schema ---
  for (const column of ["organization_id", "guest_user_id"]) {
    const { error } = await admin.from("learning_plans").select(`id, ${column}`).limit(1);
    record("schema", `learning_plans.${column}`, !error, error?.message || "present");
  }

  // --- Auth credentials ---
  for (const [label, email, password] of [
    ["regular", env.E2E_REGULAR_EMAIL, env.E2E_REGULAR_PASSWORD],
    ["teams", env.E2E_TEAMS_EMAIL, env.E2E_TEAMS_PASSWORD],
  ]) {
    const { data, error } = await anon.auth.signInWithPassword({ email, password });
    const ok = !error && !!data.session;
    record("auth", `${label} sign-in`, ok, error?.message || data.user?.id);
    if (data.session) await anon.auth.signOut();
  }

  // --- Profile tiers ---
  for (const [label, userId, expectedPlan] of [
    ["regular", env.E2E_REGULAR_USER_ID, "regular_2026"],
    ["teams", env.E2E_TEAMS_USER_ID, "pro_teams"],
  ]) {
    const { data, error } = await admin
      .from("profiles")
      .select("plan, subscription_status, organization_id, is_org_admin")
      .eq("id", userId)
      .single();
    const ok = !error && data?.plan === expectedPlan && data?.subscription_status === "active";
    record("profile", `${label} tier`, ok, ok ? `${data.plan} active` : error?.message || `${data?.plan}`);
    if (label === "teams") {
      record(
        "profile",
        "teams org admin",
        !!data?.organization_id && data?.is_org_admin,
        data?.organization_id || "missing"
      );
    }
  }

  // --- Org record ---
  const { data: org } = await admin
    .from("organizations")
    .select("id, name, slug")
    .eq("id", env.E2E_TEAMS_ORG_ID)
    .single();
  record("org", "teams org exists", !!org, org ? `${org.name} (${org.slug})` : "not found");

  // --- Public pages ---
  for (const path of ["/", "/login", "/pricing", "/docs/agentic-v2"]) {
    try {
      const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
      record("web", `GET ${path}`, res.status >= 200 && res.status < 400, `HTTP ${res.status}`);
    } catch (err) {
      record("web", `GET ${path}`, false, err.message);
    }
  }

  // --- Unauthenticated API guards ---
  const unauthUsage = await fetch(`${baseUrl}/api/check-usage`);
  record("web-api", "GET /api/check-usage unauthenticated", unauthUsage.status === 401, `HTTP ${unauthUsage.status}`);

  const apiKey = env.E2E_TEAMS_API_KEY;
  if (!apiKey) {
    record("agent-api", "teams API key configured", false, "missing E2E_TEAMS_API_KEY");
  } else {
    const bad = await agentJson("/api/v2/agent/workspaces", "sk_invalid_test_key", {
      method: "POST",
      body: JSON.stringify({ initial_prompt: "noop" }),
    });
    record("agent-api", "invalid API key rejected", bad.res.status === 401, `HTTP ${bad.res.status}`);

    const noAuth = await fetch(`${baseUrl}/api/v2/agent/workspaces`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ initial_prompt: "test" }),
    });
    record("agent-api", "missing Authorization rejected", noAuth.status === 401, `HTTP ${noAuth.status}`);

    const badBody = await agentJson("/api/v2/agent/workspaces", apiKey, {
      method: "POST",
      body: JSON.stringify({}),
    });
    record(
      "agent-api",
      "create workspace validation (empty prompt)",
      badBody.res.status === 400,
      `HTTP ${badBody.res.status}`
    );

    if (!liveWrites) {
      record("agent-api", "live writes", false, "E2E_ALLOW_LIVE_WRITES not set");
    } else {
      const create = await agentJson("/api/v2/agent/workspaces", apiKey, {
        method: "POST",
        body: JSON.stringify({
          initial_prompt:
            "[E2E-REPORT] Explain recursion with a simple factorial example for interview prep.",
        }),
      });
      const workspaceId = create.body?.workspace?.id;
      record(
        "agent-api",
        "POST /workspaces (create)",
        create.res.status === 201 && !!workspaceId,
        create.res.status === 201
          ? `${workspaceId} (${create.body?.blocks?.length ?? 0} blocks)`
          : `${create.res.status} ${JSON.stringify(create.body)}`
      );

      if (workspaceId) {
        const blocks = await agentJson(`/api/v2/agent/workspaces/${workspaceId}/blocks`, apiKey);
        const blockId = blocks.body?.blocks?.[0]?.id;
        record(
          "agent-api",
          "GET /workspaces/{id}/blocks",
          blocks.res.status === 200 && (blocks.body?.blocks?.length ?? 0) > 0,
          `${blocks.body?.blocks?.length ?? 0} blocks`
        );

        if (blockId) {
          const link = await agentJson(
            `/api/v2/agent/workspaces/${workspaceId}/blocks/${blockId}/ghl-links`,
            apiKey,
            { method: "POST", body: JSON.stringify({ minutes: 15 }) }
          );
          const linkId = link.body?.ghl_link?.id;
          record(
            "agent-api",
            "POST /blocks/{id}/ghl-links",
            link.res.status === 201 && !!linkId,
            linkId || `${link.res.status}`
          );

          const list = await agentJson(`/api/v2/agent/workspaces/${workspaceId}/ghl-links`, apiKey);
          record(
            "agent-api",
            "GET /workspaces/{id}/ghl-links",
            list.res.status === 200,
            `${list.body?.ghl_links?.length ?? 0} links`
          );

          if (linkId) {
            const results = await agentJson(
              `/api/v2/agent/workspaces/${workspaceId}/ghl-links/${linkId}/results`,
              apiKey
            );
            const status = results.body?.ghl_result?.status;
            record(
              "agent-api",
              "GET /ghl-links/{id}/results (pending)",
              results.res.status === 200,
              `status=${status}`
            );
          }

          if (link.body?.private_url) {
            const token = link.body.private_url.split("/").pop();
            const page = await fetch(`${baseUrl}/ghl-score/session/${token}`, { redirect: "manual" });
            record("agent-api", "private GHL page loads", page.status === 200, `HTTP ${page.status}`);
          }
        }
      }

      const guestEmail = `e2e-guest+${Date.now()}@openlesson.academy`;
      const guest = await agentJson("/api/v2/agent/org/guests", apiKey, {
        method: "POST",
        body: JSON.stringify({ email: guestEmail }),
      });
      record(
        "agent-api",
        "POST /org/guests (create guest + key)",
        guest.res.status === 201 && !!guest.body?.guest_user?.id && typeof guest.body?.api_key === "string",
        guest.res.status === 201
          ? `${guestEmail} key=${String(guest.body?.api_key || "").slice(0, 12)}…`
          : `${guest.res.status} ${JSON.stringify(guest.body)}`
      );

      if (typeof guest.body?.api_key === "string") {
        const guestKey = guest.body.api_key;
        const guestBlocks = await agentJson(
          `/api/v2/agent/workspaces/${guest.body?.guest ? "00000000-0000-0000-0000-000000000000" : ""}/blocks`,
          guestKey
        );
        // Guest should not read arbitrary workspace; expect 404/403 not 500
        record(
          "agent-api",
          "guest key auth works",
          guestBlocks.res.status === 404 || guestBlocks.res.status === 403 || guestBlocks.res.status === 400,
          `HTTP ${guestBlocks.res.status} on invalid workspace (expected deny)`
        );
      }
    }
  }

  // --- Regular user usage logic (server-side mirror, no HTTP cookie) ---
  const { data: regularProfile } = await admin
    .from("profiles")
    .select("plan, subscription_status, extra_lessons, is_admin, current_period_end")
    .eq("id", env.E2E_REGULAR_USER_ID)
    .single();
  record(
    "regular-tier",
    "regular_2026 plan active",
    regularProfile?.plan === "regular_2026" && regularProfile?.subscription_status === "active",
    regularProfile?.plan
  );

  const passed = report.filter((r) => r.ok).length;
  const failed = report.filter((r) => !r.ok).length;
  console.log(`\n=== REPORT SUMMARY: ${passed} passed, ${failed} failed, ${report.length} total ===`);
  if (failed) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});