/**
 * Verify the Highschool Algebra demo workspace on staging or production.
 *
 * SAFETY: default target is staging. Production only when explicitly requested:
 *   --target=prod
 *
 * Usage:
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/verify-hs-algebra-demo-workspace.ts
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/verify-hs-algebra-demo-workspace.ts --target=prod
 */

import { connectTarget } from "./db-connection.mjs";
import {
  HS_ALGEBRA_DEMO_MARKER,
  HS_ALGEBRA_DEMO_WORKSPACE,
  HS_ALGEBRA_GUESTS,
  HS_ALGEBRA_REGIONS,
} from "../lib/demo/hs-algebra-demo-workspace";
import { KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID } from "../lib/knowledge-config";
import { parseSaasTechDemoSeedTarget } from "./saas-tech-demo-target";

async function main() {
  const target = parseSaasTechDemoSeedTarget(process.argv);
  console.log(`[verify-hs-algebra-demo] target=${target} marker=${HS_ALGEBRA_DEMO_MARKER}`);
  if (target === "prod") {
    console.log("[verify-hs-algebra-demo] PRODUCTION READ: intentional --target=prod");
  }

  const { client, via } = await connectTarget(target);
  console.log(`[verify-hs-algebra-demo] connected target=${target} via ${via}`);

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
      [`%${HS_ALGEBRA_DEMO_MARKER}%`],
    );
    if (!ws.rows[0]) {
      throw new Error(`No workspace with marker ${HS_ALGEBRA_DEMO_MARKER}`);
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

    if (title !== HS_ALGEBRA_DEMO_WORKSPACE.title) {
      throw new Error(`title mismatch: ${title}`);
    }
    if (!/algebra/i.test(title) || !/high\s*school/i.test(title)) {
      throw new Error("title must be high-school algebra scoped");
    }
    if (description.length < 40) {
      throw new Error("description too short for authentic use case");
    }
    if (!String(ws.rows[0].notes || "").includes(HS_ALGEBRA_DEMO_MARKER)) {
      throw new Error("notes missing demo marker");
    }
    if (!isAdmin && !isOrgAdmin) {
      throw new Error(`owner ${ownerEmail} is neither is_admin nor is_org_admin`);
    }

    // Exactly one workspace with this marker
    const wsCount = await client.query(
      `SELECT count(*)::int AS n FROM public.workspaces WHERE notes ILIKE $1`,
      [`%${HS_ALGEBRA_DEMO_MARKER}%`],
    );
    const markerCount = wsCount.rows[0].n as number;
    console.log(`[verify] workspaces_with_marker=${markerCount}`);
    if (markerCount !== 1) {
      throw new Error(`expected exactly 1 workspace with marker, got ${markerCount}`);
    }

    const blocks = await client.query(
      `SELECT count(*)::int AS n FROM public.blocks WHERE workspace_id = $1`,
      [workspaceId],
    );
    const blockCount = blocks.rows[0].n as number;
    console.log(`[verify] blocks=${blockCount}`);
    if (blockCount < 3) throw new Error("expected ≥3 blocks");

    const powSimple = await client.query(
      `SELECT count(*)::int AS n,
              count(DISTINCT guest_user_id)::int AS guest_subjects
       FROM public.workspace_proof_of_work
       WHERE workspace_id = $1
         AND guest_user_id IS NOT NULL`,
      [workspaceId],
    );
    const powCount = powSimple.rows[0].n as number;
    const powGuestSubjects = powSimple.rows[0].guest_subjects as number;
    console.log(`[verify] pow_rows=${powCount} guest_subjects=${powGuestSubjects}`);
    if (powGuestSubjects < 3) {
      throw new Error(`expected ≥3 distinct guest PoW subjects, got ${powGuestSubjects}`);
    }
    if (powCount < HS_ALGEBRA_GUESTS.length * 2) {
      throw new Error(
        `pow_rows ${powCount} too low (need ≥2 events × ${HS_ALGEBRA_GUESTS.length} guests)`,
      );
    }

    const perGuest = await client.query(
      `SELECT guest_user_id, count(*)::int AS n,
              count(DISTINCT tool_name)::int AS tools
       FROM public.workspace_proof_of_work
       WHERE workspace_id = $1 AND guest_user_id IS NOT NULL
       GROUP BY guest_user_id`,
      [workspaceId],
    );
    for (const row of perGuest.rows) {
      const n = row.n as number;
      if (n < 2) {
        throw new Error(`guest ${row.guest_user_id} has only ${n} PoW rows (need ≥2)`);
      }
    }
    console.log(`[verify] per_guest_pow_ok guests=${perGuest.rows.length}`);

    const guests = await client.query(
      `SELECT count(*)::int AS n
       FROM public.organization_guest_users
       WHERE workspace_id = $1
          OR (metadata->>'demo_marker' = $2)`,
      [workspaceId, HS_ALGEBRA_DEMO_MARKER],
    );
    const guestCount = guests.rows[0].n as number;
    console.log(`[verify] organization_guest_users=${guestCount}`);
    if (guestCount < 3) {
      throw new Error(`expected ≥3 organization_guest_users, got ${guestCount}`);
    }

    const models = await client.query(
      `SELECT id, name, embedding_model_id, dim, subjects, cosine_threshold
       FROM public.custom_verification_models
       WHERE workspace_id = $1
       ORDER BY name`,
      [workspaceId],
    );
    console.log(`[verify] custom_verification_models=${models.rows.length}`);
    if (models.rows.length !== 2) {
      throw new Error(
        `expected exactly 2 custom_verification_models, got ${models.rows.length}`,
      );
    }
    const modelNames = models.rows.map((r) => String(r.name)).join(" ");
    expectMatch(modelNames, /Foundation/i, "region names should include Foundations");
    expectMatch(modelNames, /Advanced|Procedure/i, "region names should include Advanced Procedures");
    for (const row of models.rows) {
      if (String(row.embedding_model_id) !== KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID) {
        throw new Error(`bad embedding_model_id on ${row.name}`);
      }
      if (Number(row.dim) !== 64) {
        throw new Error(`expected dim=64 on ${row.name}, got ${row.dim}`);
      }
      const subjects = row.subjects as Array<{ label?: string }> | string;
      const labelBlob =
        typeof subjects === "string" ? subjects : JSON.stringify(subjects);
      if (!/synthetic:grok-4\.5/i.test(labelBlob)) {
        throw new Error(`region ${row.name} missing synthetic subject label`);
      }
    }

    const snaps = await client.query(
      `SELECT count(*)::int AS n,
              count(DISTINCT subject_guest_user_id)::int AS guest_subjects
       FROM public.knowledge_config_snapshots
       WHERE workspace_id = $1
         AND embedding_model_id = $2`,
      [workspaceId, KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID],
    );
    const snapCount = snaps.rows[0].n as number;
    const snapGuests = snaps.rows[0].guest_subjects as number;
    console.log(`[verify] snapshots=${snapCount} guest_subjects=${snapGuests}`);
    if (snapGuests < HS_ALGEBRA_GUESTS.length) {
      throw new Error(
        `expected ≥${HS_ALGEBRA_GUESTS.length} guest snapshots, got ${snapGuests}`,
      );
    }

    console.log("[verify-hs-algebra-demo] SUCCESS");
    console.log(
      JSON.stringify(
        {
          success: true,
          target,
          workspace_id: workspaceId,
          title,
          owner_email: ownerEmail,
          marker: HS_ALGEBRA_DEMO_MARKER,
          blocks: blockCount,
          pow_rows: powCount,
          guest_subjects: powGuestSubjects,
          organization_guest_users: guestCount,
          custom_verification_models: models.rows.length,
          region_names: models.rows.map((r) => String(r.name)),
          catalog_regions: HS_ALGEBRA_REGIONS.map((r) => r.regionName),
          snapshots: snapCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

function expectMatch(value: string, re: RegExp, msg: string) {
  if (!re.test(value)) throw new Error(`${msg}: got "${value}"`);
}

main().catch((err) => {
  console.error("[verify-hs-algebra-demo] FAILED:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
