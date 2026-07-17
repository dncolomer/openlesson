/**
 * Provision individual xAI API keys for:
 *  - product-entitled orgs (active paid / partner)
 *  - inactive orgs that already have a ready Collection ("folder")
 *
 * Uses the same Management API + seal path as lib/organization/ensure-xai-resources.ts
 * (inlined for Node without Next transpile; keep logic aligned).
 *
 * Usage:
 *   node scripts/backfill-org-xai-api-keys.mjs --staging
 *   node scripts/backfill-org-xai-api-keys.mjs --prod
 *   node scripts/backfill-org-xai-api-keys.mjs --prod --idempotent-check
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH =
  process.env.GOAL_SCRATCH_DIR ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b775a328de9c/implementer";

const MANAGEMENT_BASE = "https://management-api.x.ai";
const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const PAID_PLANS = new Set(["trial", "regular_2026", "pro_teams", "api_metered"]);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg, lines) {
  const s = typeof msg === "string" ? msg : JSON.stringify(msg);
  console.log(s);
  lines.push(s);
}

function deriveKey(secret) {
  return createHash("sha256").update(secret, "utf8").digest();
}

function sealString(plaintext, secret) {
  const key = deriveKey(secret);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function orgHasReadyXaiApiKey(org) {
  return (
    org.xai_api_key_status === "ready" &&
    !!org.xai_api_key_id &&
    !!org.xai_api_key_ciphertext
  );
}

function orgIsProductEntitled(org) {
  if (org.archived_at) return false;
  const plan = org.plan || "inactive";
  const mode = org.billing_mode || "subscription";
  if (mode === "partner") return plan !== "inactive" && PAID_PLANS.has(plan);
  if (org.subscription_status !== "active") return false;
  return PAID_PLANS.has(plan);
}

function orgHasReadyXaiCollection(org) {
  return org.xai_collection_status === "ready" && !!org.xai_collection_id;
}

/** Mirrors lib/organization/org-xai-key-selection.ts */
export function orgNeedsXaiApiKey(org) {
  if (org.archived_at) return false;
  if (orgHasReadyXaiApiKey(org)) return false;
  if (orgIsProductEntitled(org)) return true;
  if (orgHasReadyXaiCollection(org)) return true;
  return false;
}

function orgXaiResourceName(prefix, slug, orgId) {
  const short = String(orgId).replace(/-/g, "").slice(0, 8);
  const clean = String(slug || "org")
    .replace(/[^a-z0-9-]/gi, "-")
    .slice(0, 40)
    .toLowerCase();
  return `${prefix}-${clean}-${short}`;
}

async function createTeamApiKey(managementKey, teamId, name) {
  const res = await fetch(
    `${MANAGEMENT_BASE}/auth/teams/${encodeURIComponent(teamId)}/api-keys`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        acls: ["api-key:model:*", "api-key:endpoint:*"],
        qps: 10,
        qpm: 600,
        tpm: null,
      }),
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`create API key ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const apiKey = String(data.apiKey ?? data.api_key ?? "");
  const apiKeyId = String(data.apiKeyId ?? data.api_key_id ?? data.id ?? "");
  if (!apiKey || !apiKeyId) throw new Error("create API key: missing apiKey/apiKeyId");
  return { apiKey, apiKeyId, name };
}

async function countGaps(client) {
  const { rows } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM organizations
        WHERE archived_at IS NULL
          AND (
            (billing_mode = 'partner' AND plan IN ('trial','regular_2026','pro_teams','api_metered'))
            OR (subscription_status = 'active' AND plan IN ('trial','regular_2026','pro_teams','api_metered'))
          )
          AND NOT (
            xai_api_key_status = 'ready'
            AND xai_api_key_id IS NOT NULL
            AND xai_api_key_ciphertext IS NOT NULL
          )
      ) AS entitled_missing_ready_key,
      (SELECT count(*)::int FROM organizations
        WHERE archived_at IS NULL
          AND xai_collection_status = 'ready'
          AND xai_collection_id IS NOT NULL
          AND NOT (
            xai_api_key_status = 'ready'
            AND xai_api_key_id IS NOT NULL
            AND xai_api_key_ciphertext IS NOT NULL
          )
      ) AS collection_missing_ready_key,
      (SELECT count(*)::int FROM organizations
        WHERE archived_at IS NULL
          AND xai_api_key_status = 'ready'
          AND xai_api_key_id IS NOT NULL
          AND xai_api_key_ciphertext IS NOT NULL
      ) AS ready_keys
  `);
  return rows[0];
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.includes("--staging") ? "staging" : "prod";
  const delayMs = 120;

  fs.mkdirSync(SCRATCH, { recursive: true });
  const logPath = path.join(SCRATCH, `provision-xai-keys-${target}.log`);
  const lines = [];
  log(`=== backfill-org-xai-api-keys target=${target} ===`, lines);
  log(`timestamp=${new Date().toISOString()}`, lines);

  const env = loadEnvFile(".env.local");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const managementKey = process.env.XAI_MANAGEMENT_API_KEY;
  const teamId = process.env.XAI_TEAM_ID;
  const sealSecret =
    process.env.XAI_ORG_KEY_ENCRYPTION_SECRET ||
    process.env.ORG_SECRETS_ENCRYPTION_KEY ||
    process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!managementKey || !teamId) {
    log("FATAL: XAI_MANAGEMENT_API_KEY or XAI_TEAM_ID missing", lines);
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    process.exit(1);
  }
  if (!sealSecret) {
    log("FATAL: encryption secret missing", lines);
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    process.exit(1);
  }

  const isStaging = target === "staging";
  const supabaseUrl = isStaging
    ? env.STAGING_NEXT_PUBLIC_SUPABASE_URL
    : env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = isStaging
    ? env.STAGING_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
    : env.PROD_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    log("FATAL: missing Supabase URL/service role", lines);
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data: orgs, error } = await admin
    .from("organizations")
    .select(
      "id, name, slug, archived_at, plan, subscription_status, billing_mode, xai_api_key_status, xai_api_key_id, xai_api_key_ciphertext, xai_collection_id, xai_collection_status"
    )
    .is("archived_at", null);

  if (error) {
    log(`FATAL list orgs: ${error.message}`, lines);
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    process.exit(1);
  }

  const candidates = (orgs || []).filter((o) => orgNeedsXaiApiKey(o));
  log(`Orgs total (non-archived listed): ${(orgs || []).length}`, lines);
  log(`Orgs needing key: ${candidates.length}`, lines);

  let created = 0;
  let failed = 0;
  let skippedReady = 0;
  const samples = [];
  const failures = [];
  const keyIdsBefore = new Map(
    (orgs || [])
      .filter((o) => o.xai_api_key_id)
      .map((o) => [o.id, o.xai_api_key_id])
  );

  for (const org of candidates) {
    // Double-check not ready (race)
    if (orgHasReadyXaiApiKey(org)) {
      skippedReady += 1;
      continue;
    }

    try {
      const name = orgXaiResourceName("openlesson-org", org.slug || "org", org.id);
      const createdKey = await createTeamApiKey(managementKey, teamId, name);
      const ciphertext = sealString(createdKey.apiKey, sealSecret);

      const { error: upErr } = await admin
        .from("organizations")
        .update({
          xai_api_key_id: createdKey.apiKeyId,
          xai_api_key_name: createdKey.name,
          xai_api_key_ciphertext: ciphertext,
          xai_api_key_status: "ready",
          xai_api_key_error: null,
          xai_api_key_created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", org.id);

      if (upErr) throw new Error(upErr.message);

      created += 1;
      if (samples.length < 15) {
        samples.push({
          id: org.id,
          name: org.name,
          reason: orgIsProductEntitled(org) ? "entitled" : "has_collection",
          xai_api_key_status: "ready",
          xai_api_key_name: createdKey.name,
          xai_api_key_id: createdKey.apiKeyId,
          // never log secret
        });
      }
      log(
        `Provisioned key org=${org.id} name=${createdKey.name} id=${createdKey.apiKeyId}`,
        lines
      );
    } catch (err) {
      failed += 1;
      const msg = err instanceof Error ? err.message : String(err);
      await admin
        .from("organizations")
        .update({
          xai_api_key_status: "error",
          xai_api_key_error: msg.slice(0, 500),
          updated_at: new Date().toISOString(),
        })
        .eq("id", org.id);
      failures.push({ orgId: org.id, name: org.name, error: msg.slice(0, 250) });
      log(`FAILED org=${org.id}: ${msg}`, lines);
    }
    await sleep(delayMs);
  }

  // SQL gap counts
  const { client } = await connectTarget(target);
  let gaps;
  try {
    gaps = await countGaps(client);
  } finally {
    await client.end().catch(() => {});
  }

  // Sample ready keys (no secrets)
  const { data: readySample } = await admin
    .from("organizations")
    .select("id, name, plan, xai_api_key_status, xai_api_key_name, xai_api_key_id, xai_collection_status")
    .eq("xai_api_key_status", "ready")
    .limit(10);

  log("--- summary ---", lines);
  log(
    JSON.stringify(
      {
        created,
        failed,
        skippedReady,
        candidates: candidates.length,
        gaps,
        samples,
        failures,
        readySample: (readySample || []).map((r) => ({
          id: r.id,
          name: r.name,
          plan: r.plan,
          xai_api_key_status: r.xai_api_key_status,
          xai_api_key_name: r.xai_api_key_name,
          xai_api_key_id: r.xai_api_key_id,
          xai_collection_status: r.xai_collection_status,
        })),
      },
      null,
      2
    ),
    lines
  );

  const ok =
    Number(gaps.entitled_missing_ready_key) === 0 &&
    Number(gaps.collection_missing_ready_key) === 0 &&
    failed === 0;

  log(
    ok
      ? `PROVISION_KEYS_OK entitled_missing=${gaps.entitled_missing_ready_key} collection_missing=${gaps.collection_missing_ready_key} ready=${gaps.ready_keys}`
      : `PROVISION_KEYS_INCOMPLETE entitled_missing=${gaps.entitled_missing_ready_key} collection_missing=${gaps.collection_missing_ready_key} failed=${failed}`,
    lines
  );

  fs.writeFileSync(logPath, lines.join("\n") + "\n");
  // Alias prod log name for plan verification
  if (target === "prod") {
    fs.writeFileSync(path.join(SCRATCH, "provision-xai-keys-prod.log"), lines.join("\n") + "\n");
  }
  console.log(`Wrote ${logPath}`);
  process.exit(ok ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(
    path.join(SCRATCH, "provision-xai-keys-prod.log"),
    `FATAL: ${err.stack || err.message}\n`
  );
  process.exit(1);
});
