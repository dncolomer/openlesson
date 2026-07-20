#!/usr/bin/env node
/**
 * Read-only / low-risk smoke tests when .env.local points at production Supabase.
 *
 * Safe by default:
 * - No Stripe checkout
 * - No workspace/plan/org/guest creation
 * - No TAP session start/complete
 * - No xAI calls
 *
 * Usage:
 *   node scripts/safe-prod-smoke-test.mjs
 *   node scripts/safe-prod-smoke-test.mjs --with-server   # also hits local pages
 */

import { readFileSync, existsSync } from "node:fs";
import { spawn } from "node:child_process";
import { createClient } from "@supabase/supabase-js";

const args = new Set(process.argv.slice(2));
const withServer = args.has("--with-server");
const baseUrl = process.env.SMOKE_BASE_URL || "http://127.0.0.1:3000";

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

const env = { ...loadEnvFile(".env.local"), ...process.env };
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY;
const stripeKey = env.STRIPE_SECRET_KEY || "";

const results = [];
function pass(name, detail = "") {
  results.push({ name, ok: true, detail });
  console.log(`✓ ${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail = "") {
  results.push({ name, ok: false, detail });
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}
function warn(name, detail = "") {
  console.warn(`! ${name}${detail ? ` — ${detail}` : ""}`);
}

async function checkSchema() {
  if (!supabaseUrl || !serviceKey) {
    fail("env: supabase", "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
    return;
  }

  const host = supabaseUrl.replace(/^https?:\/\//, "").split("/")[0];
  pass("env: supabase host", host);

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const tables = [
    "workspace_tap_sessions",
    "organization_guest_users",
    "workspaces",
    "agent_api_keys",
  ];

  for (const table of tables) {
    const { error } = await supabase.from(table).select("id").limit(1);
    if (error) {
      fail(`db: ${table}`, error.message);
    } else {
      pass(`db: ${table}`, "readable");
    }
  }

  for (const column of ["organization_id", "guest_user_id"]) {
    const { error } = await supabase
      .from("workspaces")
      .select(`id, ${column}`)
      .limit(1);
    if (error) {
      fail(`db: workspaces.${column}`, `${error.message} — apply migration 045`);
    } else {
      pass(`db: workspaces.${column}`, "present");
    }
  }

  const { data: ghcSample, error: ghcError } = await supabase
    .from("workspace_tap_sessions")
    .select("id, organization_id, guest_user_id, private_token_hash")
    .limit(1);

  if (ghcError) {
    fail("db: workspace_tap_sessions columns", ghcError.message);
  } else if (ghcSample?.[0] && !("guest_user_id" in ghcSample[0])) {
    fail("db: workspace_tap_sessions columns", "guest/org columns missing — run migration 045");
  } else {
    pass("db: workspace_tap_sessions columns", "present");
  }
}

async function fetchStatus(path, expected = [200]) {
  const res = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
  const ok = expected.includes(res.status);
  if (ok) {
    pass(`http GET ${path}`, String(res.status));
  } else {
    fail(`http GET ${path}`, `expected ${expected.join("|")}, got ${res.status}`);
  }
  return res;
}

async function checkWriteEndpointsBlocked() {
  const writeChecks = [
    {
      name: "POST /api/v3/pow/workspaces",
      path: "/api/v3/pow/workspaces",
      body: { initial_prompt: "smoke-test-do-not-create" },
    },
    {
      name: "POST /api/organization",
      path: "/api/organization",
      body: { name: "smoke-test-do-not-create" },
    },
    {
      name: "POST /api/stripe/create-checkout",
      path: "/api/stripe/create-checkout",
      body: { plan: "regular_2026", blocks: 25 },
    },
  ];

  for (const check of writeChecks) {
    const res = await fetch(`${baseUrl}${check.path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(check.body),
    });
    if ([401, 403, 405].includes(res.status)) {
      pass(check.name, `blocked with ${res.status} (no side effects)`);
    } else if (res.status >= 500) {
      fail(check.name, `server error ${res.status}`);
    } else {
      warn(
        check.name,
        `returned ${res.status} — verify no production rows were created`
      );
    }
  }
}

async function checkPublicPages() {
  const pages = [
    "/",
    "/pricing",
    "/for-hiring-teams",
    "/workspace/new",
    "/docs/proof-of-work-api",
    "/login",
  ];
  for (const page of pages) {
    await fetchStatus(page, [200, 307, 308]);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer(timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${baseUrl}/`);
      if (res.ok || res.status === 307 || res.status === 308) return true;
    } catch {
      // retry
    }
    await sleep(500);
  }
  return false;
}

async function main() {
  console.log("Uncertain Systems safe prod smoke test");
  console.log("Mode: read-only DB probes + unauthenticated HTTP checks\n");

  if (stripeKey.startsWith("sk_live_")) {
    warn("stripe", "LIVE Stripe key detected — do not run checkout tests");
  } else if (stripeKey.startsWith("sk_test_")) {
    pass("stripe", "test mode key");
  } else {
    warn("stripe", "key mode unknown");
  }

  await checkSchema();

  if (!withServer) {
    console.log("\nSkipping HTTP checks (pass --with-server to run against local dev).");
  } else {
    console.log("\nStarting local dev server for HTTP checks...");
    const child = spawn("npm", ["run", "dev", "--", "--port", "3000"], {
      cwd: process.cwd(),
      env: { ...process.env, NEXT_PUBLIC_APP_URL: baseUrl },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let ready = false;
    child.stdout.on("data", (buf) => {
      const text = buf.toString();
      if (text.includes("Ready") || text.includes("started server")) ready = true;
    });
    child.stderr.on("data", (buf) => {
      const text = buf.toString();
      if (text.includes("Ready") || text.includes("started server")) ready = true;
    });

    if (!(await waitForServer())) {
      child.kill("SIGTERM");
      fail("dev server", `not reachable at ${baseUrl}`);
      summarize();
      process.exit(1);
    }
    pass("dev server", `reachable at ${baseUrl}`);

    await checkPublicPages();
    await checkWriteEndpointsBlocked();

    child.kill("SIGTERM");
    await sleep(500);
  }

  summarize();
}

function summarize() {
  const failed = results.filter((r) => !r.ok);
  console.log("\n--- Summary ---");
  console.log(`Checks: ${results.length} | Passed: ${results.length - failed.length} | Failed: ${failed.length}`);
  if (failed.length) {
    console.log("\nFailed:");
    for (const item of failed) console.log(`- ${item.name}: ${item.detail}`);
    process.exit(1);
  }

  console.log("\nSafe next manual steps (still use a non-admin test account):");
  console.log("1. Log in locally and open /workspace/new — only submit if you accept creating a real plan row.");
  console.log("2. Open an existing workspace you own; verify /workspace/{id}/tap UI loads.");
  console.log("3. Create a TAP link via API only with a disposable test workspace.");
  console.log("4. Do NOT run migrations 043-045 against prod until reviewed in Supabase SQL editor.");
  console.log("5. Do NOT trigger Stripe checkout unless using sk_test_ and a test user.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});