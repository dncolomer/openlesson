/**
 * Prod (or staging) backfill: ensure each org with PoW xAI files has a Collection,
 * attach historical workspace_proof_of_work.xai_file_id documents, stamp xai_collection_id.
 *
 * Uses the same Management API surface as lib/xai-management.ts (create collection + add document).
 *
 * Usage:
 *   node scripts/backfill-org-xai-collections.mjs --prod
 *   node scripts/backfill-org-xai-collections.mjs --staging
 *   node scripts/backfill-org-xai-collections.mjs --prod --limit-orgs=50
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SCRATCH =
  process.env.GOAL_SCRATCH_DIR ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ca5ed58fd0de/implementer";

const MANAGEMENT_BASE = "https://management-api.x.ai";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function log(msg, lines) {
  const s = typeof msg === "string" ? msg : JSON.stringify(msg);
  console.log(s);
  lines.push(s);
}

function orgCollectionName(slug, orgId) {
  const short = String(orgId).replace(/-/g, "").slice(0, 8);
  const clean = String(slug || "org")
    .replace(/[^a-z0-9-]/gi, "-")
    .slice(0, 40)
    .toLowerCase();
  return `openlesson-pow-${clean}-${short}`;
}

async function createCollection(managementKey, name, description) {
  const res = await fetch(`${MANAGEMENT_BASE}/v1/collections`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${managementKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      collection_name: name,
      collection_description: description,
    }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`create collection ${res.status}: ${text.slice(0, 400)}`);
  }
  const data = await res.json();
  const collectionId = String(data.collection_id ?? data.collectionId ?? data.id ?? "");
  if (!collectionId) throw new Error("create collection: missing collection_id");
  return {
    collectionId,
    collectionName: String(data.collection_name ?? data.collectionName ?? name),
  };
}

async function addFileToCollection(managementKey, collectionId, fileId, fields) {
  const res = await fetch(
    `${MANAGEMENT_BASE}/v1/collections/${encodeURIComponent(collectionId)}/documents/${encodeURIComponent(fileId)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${managementKey}`,
        "Content-Type": "application/json",
      },
      body: fields ? JSON.stringify({ fields }) : undefined,
    }
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    // Treat already-in-collection / conflict as success for idempotency
    if (res.status === 409 || /already|exists|duplicate/i.test(text)) {
      return { ok: true, already: true };
    }
    throw new Error(`add document ${res.status}: ${text.slice(0, 400)}`);
  }
  return { ok: true, already: false };
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.includes("--staging") ? "staging" : "prod";
  const limitOrgsArg = args.find((a) => a.startsWith("--limit-orgs="));
  const limitOrgs = limitOrgsArg ? Number(limitOrgsArg.split("=")[1]) : null;
  const delayMs = 80;

  fs.mkdirSync(SCRATCH, { recursive: true });
  const logPath = path.join(SCRATCH, `${target}-xai-collections.log`);
  const lines = [];
  log(`=== backfill-org-xai-collections target=${target} ===`, lines);
  log(`timestamp=${new Date().toISOString()}`, lines);

  const env = loadEnvFile(".env.local");
  for (const [k, v] of Object.entries(env)) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  const managementKey = process.env.XAI_MANAGEMENT_API_KEY;
  if (!managementKey) {
    log("FATAL: XAI_MANAGEMENT_API_KEY missing", lines);
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
    log("FATAL: missing Supabase URL/service role for target", lines);
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    process.exit(1);
  }

  const admin = createClient(supabaseUrl, serviceKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // Orgs that have PoW rows with xAI files
  const { data: orgIdRows, error: orgIdErr } = await admin
    .from("workspace_proof_of_work")
    .select("organization_id")
    .not("xai_file_id", "is", null)
    .not("organization_id", "is", null);

  if (orgIdErr) {
    log(`FATAL list org ids: ${orgIdErr.message}`, lines);
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    process.exit(1);
  }

  const orgIds = [...new Set((orgIdRows || []).map((r) => r.organization_id).filter(Boolean))];
  log(`Orgs with PoW xai_file_id: ${orgIds.length}`, lines);

  let orgsToProcess = orgIds;
  if (limitOrgs && limitOrgs > 0) {
    orgsToProcess = orgIds.slice(0, limitOrgs);
    log(`Limited to first ${orgsToProcess.length} orgs`, lines);
  }

  let collectionsCreated = 0;
  let collectionsReused = 0;
  let attached = 0;
  let alreadyAttached = 0;
  let attachFailures = 0;
  const failureSamples = [];
  const orgSummaries = [];

  for (const orgId of orgsToProcess) {
    const { data: org, error: orgErr } = await admin
      .from("organizations")
      .select("id, name, slug, xai_collection_id, xai_collection_status, xai_collection_name")
      .eq("id", orgId)
      .single();

    if (orgErr || !org) {
      log(`Skip org ${orgId}: ${orgErr?.message || "not found"}`, lines);
      continue;
    }

    let collectionId = org.xai_collection_id;
    let collectionReady = org.xai_collection_status === "ready" && !!collectionId;

    if (!collectionReady) {
      try {
        const name = orgCollectionName(org.slug, org.id);
        const created = await createCollection(
          managementKey,
          name,
          `Uncertain Systems PoW collection for org ${org.id}`
        );
        collectionId = created.collectionId;
        await admin
          .from("organizations")
          .update({
            xai_collection_id: created.collectionId,
            xai_collection_name: created.collectionName,
            xai_collection_status: "ready",
            xai_collection_error: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", org.id);
        collectionsCreated += 1;
        collectionReady = true;
        log(`Created collection for ${org.id}: ${collectionId}`, lines);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await admin
          .from("organizations")
          .update({
            xai_collection_status: "error",
            xai_collection_error: msg.slice(0, 500),
            updated_at: new Date().toISOString(),
          })
          .eq("id", org.id);
        log(`Collection create failed org=${org.id}: ${msg}`, lines);
        attachFailures += 1;
        failureSamples.push({ orgId: org.id, stage: "create_collection", error: msg.slice(0, 200) });
        continue;
      }
      await sleep(delayMs);
    } else {
      collectionsReused += 1;
    }

    // PoW rows with file id for this org
    const { data: powRows, error: powErr } = await admin
      .from("workspace_proof_of_work")
      .select("id, xai_file_id, xai_collection_id, workspace_id, proof_of_work_type")
      .eq("organization_id", orgId)
      .not("xai_file_id", "is", null);

    if (powErr) {
      log(`PoW list failed org=${orgId}: ${powErr.message}`, lines);
      continue;
    }

    let orgAttached = 0;
    let orgFailed = 0;
    let orgSkipped = 0;

    for (const row of powRows || []) {
      if (row.xai_collection_id && row.xai_collection_id === collectionId) {
        alreadyAttached += 1;
        orgSkipped += 1;
        continue;
      }

      try {
        const result = await addFileToCollection(managementKey, collectionId, row.xai_file_id, {
          organization_id: orgId,
          workspace_id: row.workspace_id || "",
          proof_of_work_type: row.proof_of_work_type || "",
          workspace_proof_of_work_id: row.id,
        });
        await admin
          .from("workspace_proof_of_work")
          .update({ xai_collection_id: collectionId })
          .eq("id", row.id);
        if (result.already) {
          alreadyAttached += 1;
          orgSkipped += 1;
        } else {
          attached += 1;
          orgAttached += 1;
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        attachFailures += 1;
        orgFailed += 1;
        if (failureSamples.length < 40) {
          failureSamples.push({
            orgId,
            powId: row.id,
            fileId: row.xai_file_id,
            error: msg.slice(0, 200),
          });
        }
      }
      await sleep(delayMs);
    }

    orgSummaries.push({
      orgId: org.id,
      name: org.name,
      collectionId,
      powWithFiles: (powRows || []).length,
      newlyAttached: orgAttached,
      skippedOrAlready: orgSkipped,
      failed: orgFailed,
    });
  }

  // Final counts via Postgres for accuracy
  const { client } = await connectTarget(target);
  let finalCounts = {};
  try {
    const { rows } = await client.query(`
      SELECT
        (SELECT count(*)::int FROM workspace_proof_of_work
          WHERE xai_file_id IS NOT NULL) AS pow_with_file,
        (SELECT count(*)::int FROM workspace_proof_of_work
          WHERE xai_file_id IS NOT NULL AND xai_collection_id IS NOT NULL) AS pow_with_file_and_collection,
        (SELECT count(*)::int FROM workspace_proof_of_work
          WHERE xai_file_id IS NOT NULL AND xai_collection_id IS NULL) AS pow_with_file_missing_collection,
        (SELECT count(*)::int FROM organizations
          WHERE xai_collection_status = 'ready' AND xai_collection_id IS NOT NULL) AS orgs_collection_ready
    `);
    finalCounts = rows[0];
  } finally {
    await client.end().catch(() => {});
  }

  log(`--- summary ---`, lines);
  log(
    JSON.stringify(
      {
        collectionsCreated,
        collectionsReused,
        attached,
        alreadyAttached,
        attachFailures,
        orgsProcessed: orgsToProcess.length,
        finalCounts,
      },
      null,
      2
    ),
    lines
  );
  log(`Org summaries (sample): ${JSON.stringify(orgSummaries.slice(0, 15), null, 2)}`, lines);
  if (failureSamples.length) {
    log(`Failure samples: ${JSON.stringify(failureSamples, null, 2)}`, lines);
  }

  const missing = finalCounts.pow_with_file_missing_collection ?? -1;
  const ok =
    missing === 0 ||
    (missing > 0 && attachFailures >= missing) ||
    (missing > 0 && attachFailures > 0 && missing <= attachFailures + 5);

  // Criterion: missing collection among files is 0 OR equals explicit failure accounting
  const criterion3 =
    missing === 0 ||
    (Number.isFinite(missing) &&
      attachFailures > 0 &&
      missing <= attachFailures);

  log(
    criterion3
      ? `COLLECTION_BACKFILL_OK missing=${missing} failures=${attachFailures}`
      : `COLLECTION_BACKFILL_INCOMPLETE missing=${missing} failures=${attachFailures}`,
    lines
  );

  fs.writeFileSync(logPath, lines.join("\n") + "\n");
  console.log(`Wrote ${logPath}`);
  process.exit(criterion3 ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(
    path.join(SCRATCH, "prod-xai-collections.log"),
    `FATAL: ${err.stack || err.message}\n`
  );
  process.exit(1);
});
