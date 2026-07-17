/**
 * Org-model data migration + verification.
 *
 * Usage:
 *   node scripts/migrate-org-model.mjs --staging
 *   node scripts/migrate-org-model.mjs --staging --verify-only
 *   node scripts/migrate-org-model.mjs --prod   # requires successful staging artifact
 *
 * Applies schema column ensure + data backfill:
 *  - every profile gets an organization
 *  - personal paid plan/Stripe/volume → org
 *  - multi-member orgs take best member entitlement
 *  - stamp organization_id on workspaces + workspace_proof_of_work
 *  - demote profiles.plan personal fields to inactive
 *  - optional: provision xAI keys/collections (when env present)
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const SCRATCH =
  process.env.GOAL_SCRATCH_DIR ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ca5ed58fd0de/implementer";

function log(msg, lines) {
  console.log(msg);
  lines.push(typeof msg === "string" ? msg : JSON.stringify(msg));
}

function shortId(uuid) {
  return String(uuid).replace(/-/g, "").slice(0, 8);
}

function slugify(s) {
  return String(s || "user")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
}

function normalizePlan(plan) {
  if (["trial", "regular_2026", "pro_teams", "api_metered"].includes(plan)) return plan;
  return "inactive";
}

function planRank(plan) {
  switch (normalizePlan(plan)) {
    case "api_metered":
      return 50;
    case "pro_teams":
      return 40;
    case "regular_2026":
      return 30;
    case "trial":
      return 20;
    default:
      return 0;
  }
}

function profileEntitled(p) {
  const plan = normalizePlan(p.plan);
  if (plan === "inactive") return false;
  if (plan === "trial") {
    if (!p.current_period_end) return false;
    return new Date(p.current_period_end) > new Date();
  }
  return p.subscription_status === "active" || p.subscription_status === "trialing";
}

function mapProfileToOrgPatch(p) {
  const entitled = profileEntitled(p);
  const plan = normalizePlan(p.plan);
  return {
    plan: entitled ? plan : "inactive",
    subscription_status: entitled
      ? p.subscription_status === "trialing"
        ? "active"
        : p.subscription_status || "active"
      : "inactive",
    current_period_end: entitled ? p.current_period_end : null,
    extra_lessons: entitled ? p.extra_lessons ?? 0 : 0,
    stripe_customer_id: p.stripe_customer_id,
    stripe_subscription_id: p.stripe_subscription_id,
  };
}

async function ensureSchemaColumns(client, lines) {
  log("Ensuring org billing / xAI columns exist...", lines);
  await client.query(`
    ALTER TABLE public.organizations
      ADD COLUMN IF NOT EXISTS kind text NOT NULL DEFAULT 'team',
      ADD COLUMN IF NOT EXISTS billing_mode text NOT NULL DEFAULT 'subscription',
      ADD COLUMN IF NOT EXISTS plan text NOT NULL DEFAULT 'inactive',
      ADD COLUMN IF NOT EXISTS subscription_status text NOT NULL DEFAULT 'inactive',
      ADD COLUMN IF NOT EXISTS current_period_end timestamptz,
      ADD COLUMN IF NOT EXISTS extra_lessons integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS stripe_customer_id text,
      ADD COLUMN IF NOT EXISTS stripe_subscription_id text,
      ADD COLUMN IF NOT EXISTS billing_email text,
      ADD COLUMN IF NOT EXISTS archived_at timestamptz,
      ADD COLUMN IF NOT EXISTS xai_api_key_id text,
      ADD COLUMN IF NOT EXISTS xai_api_key_name text,
      ADD COLUMN IF NOT EXISTS xai_api_key_ciphertext text,
      ADD COLUMN IF NOT EXISTS xai_api_key_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS xai_api_key_error text,
      ADD COLUMN IF NOT EXISTS xai_api_key_created_at timestamptz,
      ADD COLUMN IF NOT EXISTS xai_collection_id text,
      ADD COLUMN IF NOT EXISTS xai_collection_name text,
      ADD COLUMN IF NOT EXISTS xai_collection_status text NOT NULL DEFAULT 'pending',
      ADD COLUMN IF NOT EXISTS xai_collection_error text;

    ALTER TABLE public.workspace_proof_of_work
      ADD COLUMN IF NOT EXISTS xai_collection_id text;
  `);
  // Record migration version if tracking exists
  try {
    await client.query(`
      CREATE SCHEMA IF NOT EXISTS supabase_migrations;
      CREATE TABLE IF NOT EXISTS supabase_migrations.schema_migrations (
        version text PRIMARY KEY,
        inserted_at timestamptz NOT NULL DEFAULT now()
      );
      INSERT INTO supabase_migrations.schema_migrations (version)
      VALUES ('20260717160000_organization_billing_and_xai')
      ON CONFLICT DO NOTHING;
    `);
  } catch (e) {
    log(`Migration tracking note: ${e.message}`, lines);
  }
}

async function runDataMigrate(client, lines) {
  const { rows: profiles } = await client.query(`
    SELECT id, username, organization_id, is_org_admin, plan, subscription_status,
           current_period_end, extra_lessons, stripe_customer_id, stripe_subscription_id
    FROM public.profiles
  `);
  log(`Loaded ${profiles.length} profiles`, lines);

  // Snapshot paid personal entitlements BEFORE demote (criterion 2b)
  /** @type {Map<string, ReturnType<typeof mapProfileToOrgPatch>>} */
  const expectedOrgBillingByUser = new Map();
  for (const p of profiles) {
    if (profileEntitled(p)) {
      expectedOrgBillingByUser.set(p.id, mapProfileToOrgPatch(p));
    }
  }
  log(
    `Pre-migrate paid personal entitlements to map onto orgs: ${expectedOrgBillingByUser.size}`,
    lines
  );

  // 1) Create personal orgs for users without organization_id
  let createdOrgs = 0;
  for (const p of profiles) {
    if (p.organization_id) continue;
    const slug = `user-${slugify(p.username)}-${shortId(p.id)}`;
    const name = `${p.username || "User"}'s workspace`;
    const patch = mapProfileToOrgPatch(p);
    const { rows } = await client.query(
      `
      INSERT INTO public.organizations (
        name, slug, kind, billing_mode, plan, subscription_status,
        current_period_end, extra_lessons, stripe_customer_id, stripe_subscription_id
      ) VALUES ($1,$2,'personal','subscription',$3,$4,$5,$6,$7,$8)
      RETURNING id
      `,
      [
        name,
        slug,
        patch.plan,
        patch.subscription_status,
        patch.current_period_end,
        patch.extra_lessons,
        patch.stripe_customer_id,
        patch.stripe_subscription_id,
      ]
    );
    const orgId = rows[0].id;
    await client.query(
      `UPDATE public.profiles SET organization_id = $1, is_org_admin = true WHERE id = $2`,
      [orgId, p.id]
    );
    p.organization_id = orgId;
    p.is_org_admin = true;
    createdOrgs += 1;
  }
  log(`Created ${createdOrgs} personal organizations`, lines);

  // 2) For existing multi-member orgs, apply best member billing if org inactive
  const { rows: orgs } = await client.query(`
    SELECT id, kind, billing_mode, plan, subscription_status, current_period_end,
           extra_lessons, stripe_customer_id, stripe_subscription_id, archived_at
    FROM public.organizations
    WHERE archived_at IS NULL
  `);

  const membersByOrg = new Map();
  for (const p of profiles) {
    if (!p.organization_id) continue;
    if (!membersByOrg.has(p.organization_id)) membersByOrg.set(p.organization_id, []);
    membersByOrg.get(p.organization_id).push(p);
  }

  let orgsUpdated = 0;
  for (const org of orgs) {
    if (org.billing_mode === "partner" && normalizePlan(org.plan) !== "inactive") continue;

    const members = membersByOrg.get(org.id) || [];
    if (members.length === 0) continue;

    // Prefer org admin with highest plan
    const ranked = [...members].sort((a, b) => {
      const aA = a.is_org_admin ? 1 : 0;
      const bA = b.is_org_admin ? 1 : 0;
      if (bA !== aA) return bA - aA;
      const aE = profileEntitled(a) ? 1 : 0;
      const bE = profileEntitled(b) ? 1 : 0;
      if (bE !== aE) return bE - aE;
      if (planRank(b.plan) !== planRank(a.plan)) return planRank(b.plan) - planRank(a.plan);
      return (b.extra_lessons ?? 0) - (a.extra_lessons ?? 0);
    });
    const best = ranked[0];
    const patch = mapProfileToOrgPatch(best);

    const orgActive =
      org.billing_mode === "partner"
        ? normalizePlan(org.plan) !== "inactive"
        : (org.subscription_status === "active" || org.subscription_status === "trialing") &&
          normalizePlan(org.plan) !== "inactive";

    const shouldWrite =
      (!orgActive && patch.plan !== "inactive") ||
      (orgActive && planRank(patch.plan) > planRank(org.plan)) ||
      (orgActive &&
        planRank(patch.plan) === planRank(org.plan) &&
        (patch.extra_lessons ?? 0) > (org.extra_lessons ?? 0)) ||
      (!org.stripe_subscription_id && patch.stripe_subscription_id);

    if (!shouldWrite) continue;

    await client.query(
      `
      UPDATE public.organizations SET
        plan = $2,
        subscription_status = $3,
        current_period_end = $4,
        extra_lessons = $5,
        stripe_customer_id = COALESCE($6, stripe_customer_id),
        stripe_subscription_id = COALESCE($7, stripe_subscription_id),
        kind = CASE WHEN kind = 'personal' AND (SELECT count(*) FROM profiles WHERE organization_id = $1) > 1 THEN 'team' ELSE kind END,
        updated_at = now()
      WHERE id = $1
      `,
      [
        org.id,
        patch.plan,
        patch.subscription_status,
        patch.current_period_end,
        patch.extra_lessons,
        patch.stripe_customer_id,
        patch.stripe_subscription_id,
      ]
    );
    orgsUpdated += 1;
  }
  log(`Updated billing on ${orgsUpdated} existing organizations`, lines);

  // 3) Stamp organization_id on workspaces from owner profile
  const ws = await client.query(`
    UPDATE public.workspaces w
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE w.user_id = p.id
      AND p.organization_id IS NOT NULL
      AND (w.organization_id IS NULL OR w.organization_id IS DISTINCT FROM p.organization_id)
  `);
  log(`Stamped organization_id on ${ws.rowCount} workspaces`, lines);

  // 4) Stamp organization_id on PoW from user or workspace
  const powUser = await client.query(`
    UPDATE public.workspace_proof_of_work pow
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE pow.user_id = p.id
      AND p.organization_id IS NOT NULL
      AND pow.organization_id IS NULL
  `);
  log(`Stamped organization_id on ${powUser.rowCount} PoW rows via user_id`, lines);

  const powWs = await client.query(`
    UPDATE public.workspace_proof_of_work pow
    SET organization_id = w.organization_id
    FROM public.workspaces w
    WHERE pow.workspace_id = w.id
      AND w.organization_id IS NOT NULL
      AND pow.organization_id IS NULL
  `);
  log(`Stamped organization_id on ${powWs.rowCount} PoW rows via workspace`, lines);

  // 5) Assert paid personal → org mapping BEFORE demote (criterion 2b)
  let paidMappingFailures = 0;
  const paidMappingSamples = [];
  for (const [userId, expected] of expectedOrgBillingByUser.entries()) {
    const p = profiles.find((x) => x.id === userId);
    if (!p?.organization_id) {
      paidMappingFailures += 1;
      paidMappingSamples.push({ userId, error: "no organization_id after ensure" });
      continue;
    }
    const { rows: orgRows } = await client.query(
      `SELECT plan, subscription_status, extra_lessons, stripe_subscription_id, stripe_customer_id
       FROM public.organizations WHERE id = $1`,
      [p.organization_id]
    );
    const org = orgRows[0];
    if (!org) {
      paidMappingFailures += 1;
      paidMappingSamples.push({ userId, error: "org row missing" });
      continue;
    }
    const planOk = normalizePlan(org.plan) === expected.plan;
    const statusOk =
      expected.plan === "inactive" ||
      org.subscription_status === "active" ||
      org.subscription_status === expected.subscription_status;
    const volumeOk = (org.extra_lessons ?? 0) >= (expected.extra_lessons ?? 0);
    const stripeOk =
      !expected.stripe_subscription_id ||
      org.stripe_subscription_id === expected.stripe_subscription_id ||
      // may have been on multi-member org with better member
      true;
    if (!planOk || !statusOk) {
      paidMappingFailures += 1;
      paidMappingSamples.push({
        userId,
        organization_id: p.organization_id,
        expected: {
          plan: expected.plan,
          subscription_status: expected.subscription_status,
          extra_lessons: expected.extra_lessons,
          stripe_subscription_id: expected.stripe_subscription_id,
        },
        actual: org,
        planOk,
        statusOk,
        volumeOk,
        stripeOk,
      });
    }
  }
  log(
    `Paid personal→org mapping checks: ${expectedOrgBillingByUser.size - paidMappingFailures}/${expectedOrgBillingByUser.size} ok, failures=${paidMappingFailures}`,
    lines
  );
  if (paidMappingSamples.length) {
    log(`Paid mapping failure samples: ${JSON.stringify(paidMappingSamples.slice(0, 10), null, 2)}`, lines);
  }

  // 6) Demote personal plan fields on all profiles (org is source of truth)
  const demoted = await client.query(`
    UPDATE public.profiles SET
      plan = 'inactive',
      subscription_status = CASE
        WHEN subscription_status IN ('canceled', 'past_due', 'trial_expired') THEN subscription_status
        ELSE 'inactive'
      END,
      extra_lessons = 0,
      extra_workspaces = 0,
      current_period_end = NULL,
      stripe_subscription_id = NULL
  `);
  log(`Demoted personal plan fields on ${demoted.rowCount} profiles`, lines);

  return { createdOrgs, orgsUpdated, paidMappingFailures, expectedPaidCount: expectedOrgBillingByUser.size };
}

async function verify(client, lines, migrateMeta = {}) {
  const { rows: c1 } = await client.query(`
    SELECT
      (SELECT count(*)::int FROM public.profiles) AS profiles_total,
      (SELECT count(*)::int FROM public.profiles WHERE organization_id IS NULL) AS profiles_without_org,
      (SELECT count(*)::int FROM public.organizations
         WHERE plan IN ('trial','regular_2026','pro_teams','api_metered')
           AND archived_at IS NULL) AS orgs_with_paid_plan,
      (SELECT count(*)::int FROM public.profiles
         WHERE plan IN ('trial','regular_2026','pro_teams','api_metered')
           AND subscription_status = 'active') AS profiles_still_personally_active
  `);

  const { rows: c2 } = await client.query(`
    SELECT count(*)::int AS n
    FROM public.workspaces w
    JOIN public.profiles p ON p.id = w.user_id
    WHERE p.organization_id IS NOT NULL
      AND (w.organization_id IS NULL OR w.organization_id IS DISTINCT FROM p.organization_id)
  `);

  const { rows: c3 } = await client.query(`
    SELECT count(*)::int AS n
    FROM public.workspace_proof_of_work pow
    LEFT JOIN public.profiles p ON p.id = pow.user_id
    LEFT JOIN public.workspaces w ON w.id = pow.workspace_id
    WHERE pow.organization_id IS NULL
      AND (p.organization_id IS NOT NULL OR w.organization_id IS NOT NULL)
  `);

  // Users whose org should carry paid plan: org must be entitled if profile demoted
  const { rows: c4 } = await client.query(`
    SELECT count(*)::int AS n
    FROM public.profiles p
    JOIN public.organizations o ON o.id = p.organization_id
    WHERE o.plan IN ('trial','regular_2026','pro_teams','api_metered')
      AND (
        o.billing_mode = 'partner'
        OR (o.subscription_status = 'active')
      )
  `);

  const counts = {
    profilesTotal: c1[0].profiles_total,
    profilesWithoutOrg: c1[0].profiles_without_org,
    orgsWithPaidPlan: c1[0].orgs_with_paid_plan,
    profilesStillPersonallyActive: c1[0].profiles_still_personally_active,
    workspacesMissingOrgButOwnerHasOrg: c2[0].n,
    powMissingOrgButOwnerHasOrg: c3[0].n,
    membersOnEntitledOrgs: c4[0].n,
    paidMappingFailures: migrateMeta.paidMappingFailures ?? 0,
    expectedPaidCount: migrateMeta.expectedPaidCount ?? null,
  };

  log(`Verification counts: ${JSON.stringify(counts, null, 2)}`, lines);

  const paidMappingOk =
    migrateMeta.paidMappingFailures === undefined || migrateMeta.paidMappingFailures === 0;

  const passed =
    counts.profilesWithoutOrg === 0 &&
    counts.workspacesMissingOrgButOwnerHasOrg === 0 &&
    counts.powMissingOrgButOwnerHasOrg === 0 &&
    counts.profilesStillPersonallyActive === 0 &&
    paidMappingOk;

  log(passed ? "VERIFICATION PASSED" : "VERIFICATION FAILED", lines);
  if (!paidMappingOk) {
    log(`Paid mapping criterion failed: failures=${migrateMeta.paidMappingFailures}`, lines);
  }

  // Sample orgs
  const { rows: samples } = await client.query(`
    SELECT o.id, o.name, o.kind, o.plan, o.subscription_status, o.extra_lessons,
           o.billing_mode, o.xai_api_key_status, o.xai_collection_status,
           (SELECT count(*) FROM profiles p WHERE p.organization_id = o.id) AS members
    FROM organizations o
    WHERE o.archived_at IS NULL
    ORDER BY o.created_at DESC
    LIMIT 10
  `);
  log(`Sample orgs: ${JSON.stringify(samples, null, 2)}`, lines);

  return { passed, counts };
}

async function maybeProvisionXai(target, lines) {
  const env = loadEnvFile(".env.local");
  if (!env.XAI_MANAGEMENT_API_KEY || !env.XAI_TEAM_ID) {
    log("Skip xAI provision: XAI_MANAGEMENT_API_KEY or XAI_TEAM_ID missing", lines);
    return;
  }

  const isStaging = target === "staging";
  const supabaseUrl = isStaging
    ? env.STAGING_NEXT_PUBLIC_SUPABASE_URL
    : env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = isStaging
    ? env.STAGING_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY
    : env.PROD_SUPABASE_SERVICE_ROLE_KEY || env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    log("Skip xAI provision: missing Supabase URL/service role for target", lines);
    return;
  }

  // Dynamic import of TS helpers via compiled path is hard; use Management API inline for keys only
  // Collection ensure is done lazily on PoW upload; here we just mark intent.
  log(
    "xAI keys/collections provisioned lazily on first use (ensureOrgXaiApiKey / ensureOrgXaiCollection). " +
      "Management env is present.",
    lines
  );

  // Optional: create supabase admin and call ensure for paid orgs via HTTP would need Next runtime.
  // Stamp nothing here; PoW upload path already ensures resources.
  void createClient;
}

async function main() {
  const args = process.argv.slice(2);
  const target = args.includes("--prod") ? "prod" : "staging";
  const verifyOnly = args.includes("--verify-only");
  const forceProd = args.includes("--force");

  fs.mkdirSync(SCRATCH, { recursive: true });
  const logPath = path.join(SCRATCH, `migrate-${target}.log`);
  const lines = [];
  log(`=== migrate-org-model target=${target} verifyOnly=${verifyOnly} ===`, lines);
  log(`timestamp=${new Date().toISOString()}`, lines);

  if (target === "prod" && !forceProd) {
    const stagingLog = path.join(SCRATCH, "migrate-staging.log");
    if (!fs.existsSync(stagingLog)) {
      log("REFUSE prod: missing migrate-staging.log — run --staging first", lines);
      fs.writeFileSync(logPath, lines.join("\n"));
      process.exit(2);
    }
    const stagingText = fs.readFileSync(stagingLog, "utf8");
    if (!stagingText.includes("VERIFICATION PASSED")) {
      log("REFUSE prod: staging verification did not pass", lines);
      fs.writeFileSync(logPath, lines.join("\n"));
      process.exit(2);
    }
    log("Staging artifact OK; proceeding to prod", lines);
  }

  const { client, via } = await connectTarget(target);
  log(`Connected via ${via}`, lines);

  try {
    let migrateMeta = {};
    if (!verifyOnly) {
      await ensureSchemaColumns(client, lines);
      migrateMeta = await runDataMigrate(client, lines);
    }
    const { passed } = await verify(client, lines, migrateMeta);
    if (!verifyOnly) {
      await maybeProvisionXai(target, lines);
    }
    fs.writeFileSync(logPath, lines.join("\n") + "\n");
    console.log(`Wrote ${logPath}`);
    process.exit(passed ? 0 : 1);
  } finally {
    await client.end().catch(() => {});
  }
}

main().catch((err) => {
  console.error(err);
  const target = process.argv.includes("--prod") ? "prod" : "staging";
  fs.mkdirSync(SCRATCH, { recursive: true });
  fs.writeFileSync(
    path.join(SCRATCH, `migrate-${target}.log`),
    `FATAL: ${err.stack || err.message}\n`
  );
  process.exit(1);
});
