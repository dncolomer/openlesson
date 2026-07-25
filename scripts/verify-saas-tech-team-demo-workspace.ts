/**
 * Staging-only verification for the SaaS tech-team demo workspace.
 * Reads via connectTarget("staging") and asserts acceptance criteria.
 *
 * Usage:
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/verify-saas-tech-team-demo-workspace.ts
 */

import { connectTarget } from "./db-connection.mjs";
import {
  SAAS_TECH_DEMO_MARKER,
  SAAS_TECH_DEMO_WORKSPACE,
  DEMO_COHORT_REGION,
  DEMO_OWNER_SUBJECT,
  DEMO_SUBJECTS,
  buildRoleRegion,
  DEMO_ROLE_REGIONS,
  encodeDemoSubject,
  scoreSubjectsAgainstRoleRegions,
  assertMixedRoleMembership,
} from "../lib/demo/saas-tech-team-demo-workspace";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  scoreAgainstCustomVerificationModel,
} from "../lib/knowledge-config";

async function main() {
  const { client, via } = await connectTarget("staging");
  console.log(`[verify-saas-tech-demo] connected via ${via}`);

  try {
    const ws = await client.query(
      `SELECT w.id, w.title, w.description, w.notes, w.workspace_goal, w.organization_id,
              w.user_id, u.email AS owner_email, p.is_admin, p.is_org_admin
       FROM public.workspaces w
       JOIN auth.users u ON u.id = w.user_id
       JOIN public.profiles p ON p.id = w.user_id
       WHERE w.notes ILIKE $1
       ORDER BY w.created_at DESC
       LIMIT 1`,
      [`%${SAAS_TECH_DEMO_MARKER}%`],
    );
    if (!ws.rows[0]) {
      throw new Error(`No workspace with marker ${SAAS_TECH_DEMO_MARKER}`);
    }
    const workspaceId = String(ws.rows[0].id);
    const ownerUserId = String(ws.rows[0].user_id);
    const title = String(ws.rows[0].title);
    const description = String(ws.rows[0].description || "");
    const ownerEmail = String(ws.rows[0].owner_email);
    const isAdmin = Boolean(ws.rows[0].is_admin);
    const isOrgAdmin = Boolean(ws.rows[0].is_org_admin);
    console.log(`[verify] workspace_id=${workspaceId}`);
    console.log(`[verify] title=${title}`);
    console.log(
      `[verify] owner=${ownerEmail} user_id=${ownerUserId} is_admin=${isAdmin} is_org_admin=${isOrgAdmin}`,
    );

    if (title !== SAAS_TECH_DEMO_WORKSPACE.title) {
      throw new Error(`title mismatch: ${title}`);
    }
    if (/orbit demo|product-demo shell/i.test(title)) {
      throw new Error("title must look like a normal workspace, not Orbit product demo");
    }
    if (description.length < 40) {
      throw new Error("description too short for authentic use case");
    }
    if (!String(ws.rows[0].notes || "").includes(SAAS_TECH_DEMO_MARKER)) {
      throw new Error("notes missing demo marker");
    }
    if (!isAdmin && !isOrgAdmin) {
      throw new Error(`owner ${ownerEmail} is neither is_admin nor is_org_admin`);
    }

    const blocks = await client.query(
      `SELECT count(*)::int AS n FROM public.blocks WHERE workspace_id = $1`,
      [workspaceId],
    );
    const blockCount = blocks.rows[0].n as number;
    console.log(`[verify] blocks=${blockCount}`);
    if (blockCount < 3) throw new Error("expected ≥3 blocks");

    const pow = await client.query(
      `SELECT count(*)::int AS n,
              count(DISTINCT guest_user_id)::int AS guest_subjects,
              count(*) FILTER (WHERE user_id = $2 AND guest_user_id IS NULL)::int AS owner_rows
       FROM public.workspace_proof_of_work
       WHERE workspace_id = $1`,
      [workspaceId, ownerUserId],
    );
    const powCount = pow.rows[0].n as number;
    const powGuestSubjects = pow.rows[0].guest_subjects as number;
    const ownerPowRows = pow.rows[0].owner_rows as number;
    console.log(
      `[verify] pow_rows=${powCount} guest_subjects=${powGuestSubjects} owner_pow_rows=${ownerPowRows}`,
    );
    if (powCount < DEMO_SUBJECTS.length + DEMO_OWNER_SUBJECT.powEvents.length) {
      throw new Error(
        `pow_rows ${powCount} too low (need guests + owner events)`,
      );
    }
    if (powGuestSubjects < 4) throw new Error("expected ≥4 guest PoW subjects");
    if (ownerPowRows < 1) {
      throw new Error(
        `expected ≥1 PoW rows with user_id=owner (${ownerUserId}), got ${ownerPowRows}`,
      );
    }
    if (ownerPowRows < DEMO_OWNER_SUBJECT.powEvents.length) {
      throw new Error(
        `owner PoW rows ${ownerPowRows} < expected ${DEMO_OWNER_SUBJECT.powEvents.length}`,
      );
    }

    const snaps = await client.query(
      `SELECT count(*)::int AS n,
              count(DISTINCT subject_guest_user_id)::int AS guest_subjects,
              count(*) FILTER (WHERE subject_user_id = $3 AND subject_guest_user_id IS NULL)::int AS owner_snaps
       FROM public.knowledge_config_snapshots
       WHERE workspace_id = $1
         AND embedding_model_id = $2`,
      [workspaceId, KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID, ownerUserId],
    );
    const snapCount = snaps.rows[0].n as number;
    const snapGuestSubjects = snaps.rows[0].guest_subjects as number;
    const ownerSnaps = snaps.rows[0].owner_snaps as number;
    console.log(
      `[verify] snapshots=${snapCount} guest_subjects=${snapGuestSubjects} owner_snapshots=${ownerSnaps}`,
    );
    if (snapGuestSubjects < DEMO_SUBJECTS.length) {
      throw new Error(
        `expected ≥${DEMO_SUBJECTS.length} guest subject snapshots, got ${snapGuestSubjects}`,
      );
    }
    if (ownerSnaps < 1) {
      throw new Error(
        `expected ≥1 knowledge_config snapshot for subject_user_id=owner, got ${ownerSnaps}`,
      );
    }

    const regions = await client.query(
      `SELECT id, name, description, subjects, cosine_threshold, subject_count, centroid
       FROM public.custom_verification_models
       WHERE workspace_id = $1
       ORDER BY name`,
      [workspaceId],
    );
    console.log(`[verify] custom_verification_models=${regions.rows.length}`);
    for (const r of regions.rows) {
      console.log(
        `  - ${r.name} subjects=${r.subject_count} thr=${r.cosine_threshold}`,
      );
    }

    const roleNames = DEMO_ROLE_REGIONS.map((r) => r.regionName);
    const foundRoleRegions = regions.rows.filter((r) =>
      roleNames.includes(String(r.name)),
    );
    if (foundRoleRegions.length < 3) {
      throw new Error(`expected ≥3 role regions, found ${foundRoleRegions.length}`);
    }

    const cohort = regions.rows.find((r) => String(r.name) === DEMO_COHORT_REGION.name);
    if (!cohort) throw new Error(`missing cohort region ${DEMO_COHORT_REGION.name}`);
    const cohortDesc = String(cohort.description || "");
    if (/\[synthetic:grok-4\.5\]/i.test(cohortDesc)) {
      throw new Error("cohort description must not use synthetic tag");
    }
    const cohortSubjects = Array.isArray(cohort.subjects) ? cohort.subjects : [];
    for (const s of cohortSubjects as Array<{ label?: string }>) {
      if (typeof s.label === "string" && /synthetic:grok-4\.5/i.test(s.label)) {
        throw new Error("cohort subject refs must not use synthetic tag");
      }
    }
    if (cohortSubjects.length < 1) {
      throw new Error("cohort must reference ≥1 subject");
    }
    console.log(`[verify] cohort ok subjects=${JSON.stringify(cohortSubjects)}`);

    // Load snapshot vectors and score against a stored Backend region
    const backendRow = regions.rows.find((r) => String(r.name) === "Backend Engineering");
    if (!backendRow) throw new Error("missing Backend Engineering region");

    const subjectSnaps = await client.query(
      `SELECT s.subject_guest_user_id, s.subject_user_id, s.vector, g.metadata, u.email AS user_email
       FROM public.knowledge_config_snapshots s
       LEFT JOIN public.organization_guest_users g ON g.id = s.subject_guest_user_id
       LEFT JOIN auth.users u ON u.id = s.subject_user_id
       WHERE s.workspace_id = $1
         AND s.embedding_model_id = $2
       ORDER BY s.as_of_ms DESC`,
      [workspaceId, KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID],
    );

    const model = {
      name: String(backendRow.name),
      embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
      dim: 64,
      centroid: backendRow.centroid as number[],
      cosine_threshold: Number(backendRow.cosine_threshold),
      mean_radius: 0.4,
    };

    let inCount = 0;
    let outCount = 0;
    const samples: string[] = [];
    for (const row of subjectSnaps.rows) {
      const vector = row.vector as number[];
      const score = scoreAgainstCustomVerificationModel(vector, model);
      const meta = (row.metadata || {}) as { display_name?: string; subject_key?: string };
      const label =
        meta.display_name ||
        meta.subject_key ||
        (row.subject_user_id
          ? `owner:${row.user_email || String(row.subject_user_id).slice(0, 8)}`
          : String(row.subject_guest_user_id));
      if (score.in_region) inCount += 1;
      else outCount += 1;
      samples.push(
        `${label}: ${score.in_region ? "IN" : "OUT"} cos=${score.cosine_similarity.toFixed(3)}`,
      );
    }
    console.log(`[verify] Backend membership from DB vectors: in=${inCount} out=${outCount}`);
    for (const s of samples) console.log(`  ${s}`);

    if (inCount < 1 || outCount < 1) {
      throw new Error(
        `expected mixed membership against Backend region (in=${inCount} out=${outCount})`,
      );
    }

    // Pure recompute also shows mixed (sanity vs pure helpers)
    const pureRegions = DEMO_ROLE_REGIONS.map((role) => ({
      roleKey: role.key,
      model: buildRoleRegion(role, workspaceId),
    }));
    const pureEncoded = DEMO_SUBJECTS.map((s) => encodeDemoSubject(s, { workspaceId }));
    const pureMembership = scoreSubjectsAgainstRoleRegions(pureEncoded, pureRegions);
    const mixed = assertMixedRoleMembership(pureMembership);
    console.log(
      `[verify] pure geometry in=${mixed.inRegion.length} out=${mixed.outOfRegion.length}`,
    );

    const summary = {
      success: true,
      target: "staging",
      workspace_id: workspaceId,
      title,
      owner_email: ownerEmail,
      owner_user_id: ownerUserId,
      owner_is_admin: isAdmin,
      owner_is_org_admin: isOrgAdmin,
      presentation: "regular_workspace",
      blocks: blockCount,
      pow_rows: powCount,
      pow_guest_subjects: powGuestSubjects,
      owner_pow_rows: ownerPowRows,
      snapshots: snapCount,
      snapshot_guest_subjects: snapGuestSubjects,
      owner_snapshots: ownerSnaps,
      role_regions: foundRoleRegions.map((r) => r.name),
      cohort_region: cohort.name,
      backend_in_region_subjects: inCount,
      backend_out_of_region_subjects: outCount,
      membership_samples: samples,
    };
    console.log("[verify-saas-tech-demo] SUCCESS");
    console.log(JSON.stringify(summary, null, 2));
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error("[verify-saas-tech-demo] FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
