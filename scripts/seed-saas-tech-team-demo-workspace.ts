/**
 * Seed the Helios Cloud (SaaS tech-team) demo workspace with:
 *  - authentic multi-role SaaS tech-team copy + blocks
 *  - faked PoW rows for multiple subjects
 *  - knowledge_config_snapshots (real encoder vectors)
 *  - role regions (synthetic:grok-4.5 style)
 *  - one cohort region built from user PoW (no synthetic tag)
 *
 * SAFETY: default target is staging. Production only when explicitly requested:
 *   --target=prod
 * Refuses unknown targets.
 *
 * Usage:
 *   # staging (safe default)
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-saas-tech-team-demo-workspace.ts
 *   # production (intentional)
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-saas-tech-team-demo-workspace.ts --target=prod
 *
 * Idempotent: finds workspace by notes marker SAAS_TECH_DEMO_MARKER and replaces it.
 */

import { randomUUID } from "node:crypto";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";
import {
  DEMO_BLOCKS,
  DEMO_COHORT_REGION,
  DEMO_OWNER_SUBJECT,
  DEMO_ROLE_REGIONS,
  DEMO_SUBJECTS,
  SAAS_TECH_DEMO_MARKER,
  SAAS_TECH_DEMO_WORKSPACE,
  assertMixedRoleMembership,
  buildDemoCohortRegion,
  buildRoleRegion,
  demoGuestEmail,
  encodeAllDemoSubjects,
  encodeDemoOwnerSubject,
  scoreSubjectsAgainstRoleRegions,
  type DemoSubjectDefinition,
} from "../lib/demo/saas-tech-team-demo-workspace";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_DIM,
} from "../lib/knowledge-config";
import {
  parseSaasTechDemoSeedTarget,
  type SaasTechDemoTarget,
} from "./saas-tech-demo-target";

// Re-export for callers that import from the seed script path.
export { parseSaasTechDemoSeedTarget } from "./saas-tech-demo-target";

function argTarget(): SaasTechDemoTarget {
  return parseSaasTechDemoSeedTarget(process.argv);
}

async function resolveOwner(client: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}): Promise<{
  userId: string;
  organizationId: string;
  email: string;
  isAdmin: boolean;
  isOrgAdmin: boolean;
}> {
  // Prefer platform admin (is_admin), then org admin — so the workspace appears
  // under a real admin account as a normal owned workspace.
  const preferred = await client.query(
    `
    SELECT u.id AS user_id, p.organization_id, u.email, p.is_admin, p.is_org_admin
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.organization_id IS NOT NULL
      AND (p.is_admin = true OR p.is_org_admin = true)
    ORDER BY
      CASE
        WHEN p.is_admin = true THEN 0
        WHEN p.is_org_admin = true THEN 1
        ELSE 2
      END,
      CASE
        WHEN u.email ILIKE 'uncertainsystems@%' THEN 0
        WHEN u.email ILIKE '%proven%' THEN 1
        ELSE 2
      END,
      u.created_at DESC
    LIMIT 1
    `,
  );
  if (preferred.rows[0]) {
    return {
      userId: String(preferred.rows[0].user_id),
      organizationId: String(preferred.rows[0].organization_id),
      email: String(preferred.rows[0].email),
      isAdmin: Boolean(preferred.rows[0].is_admin),
      isOrgAdmin: Boolean(preferred.rows[0].is_org_admin),
    };
  }

  throw new Error(
    "No admin (is_admin) or org-admin profile with organization_id found to own the demo workspace",
  );
}

async function findExistingDemoWorkspace(client: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string }> }>;
}): Promise<string | null> {
  const res = await client.query(
    `SELECT id FROM public.workspaces WHERE notes ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
    [`%${SAAS_TECH_DEMO_MARKER}%`],
  );
  return res.rows[0]?.id ?? null;
}

async function deleteWorkspaceCascade(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  workspaceId: string,
) {
  // Children mostly CASCADE from workspaces; guests may reference workspace_id.
  // PoW / snapshots / models / blocks / guests deleted via FK cascade where possible.
  await client.query(`DELETE FROM public.custom_verification_models WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.knowledge_config_snapshots WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.workspace_proof_of_work WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.blocks WHERE workspace_id = $1`, [workspaceId]);
  // Guests created for this demo — only those tagged in metadata
  await client.query(
    `DELETE FROM public.organization_guest_users
     WHERE workspace_id = $1
        OR (metadata->>'demo_marker' = $2)`,
    [workspaceId, SAAS_TECH_DEMO_MARKER],
  );
  await client.query(`DELETE FROM public.workspaces WHERE id = $1`, [workspaceId]);
}

async function ensureGuest(
  client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  },
  options: {
    organizationId: string;
    workspaceId: string;
    createdBy: string;
    subject: DemoSubjectDefinition;
  },
): Promise<string> {
  const email = demoGuestEmail(options.subject.emailLocalPart);
  const existing = await client.query(
    `SELECT id FROM public.organization_guest_users WHERE organization_id = $1 AND lower(email) = lower($2) LIMIT 1`,
    [options.organizationId, email],
  );
  if (existing.rows[0]) {
    const id = String(existing.rows[0].id);
    await client.query(
      `UPDATE public.organization_guest_users
       SET workspace_id = $1,
           status = 'active',
           metadata = COALESCE(metadata, '{}'::jsonb) || $2::jsonb,
           updated_at = now()
       WHERE id = $3`,
      [
        options.workspaceId,
        JSON.stringify({
          demo_marker: SAAS_TECH_DEMO_MARKER,
          subject_key: options.subject.key,
          display_name: options.subject.displayName,
          role_hint: options.subject.roleHint,
        }),
        id,
      ],
    );
    return id;
  }

  const id = randomUUID();
  await client.query(
    `INSERT INTO public.organization_guest_users (
       id, organization_id, email, status, created_by_user_id, workspace_id, metadata
     ) VALUES ($1, $2, $3, 'active', $4, $5, $6::jsonb)`,
    [
      id,
      options.organizationId,
      email,
      options.createdBy,
      options.workspaceId,
      JSON.stringify({
        demo_marker: SAAS_TECH_DEMO_MARKER,
        subject_key: options.subject.key,
        display_name: options.subject.displayName,
        role_hint: options.subject.roleHint,
      }),
    ],
  );
  return id;
}

async function main() {
  const target = argTarget();
  console.log(`[seed-saas-tech-demo] target=${target} marker=${SAAS_TECH_DEMO_MARKER}`);
  if (target === "prod") {
    console.log(
      "[seed-saas-tech-demo] PRODUCTION WRITE: intentional --target=prod; idempotent on demo marker",
    );
  }

  // Guard: env must have the chosen target's Supabase URL (connectTarget also enforces).
  const env = loadEnvFile(".env.local");
  if (target === "staging" && !env.STAGING_NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[seed-saas-tech-demo] SKIP: Missing STAGING_NEXT_PUBLIC_SUPABASE_URL");
    process.exitCode = 2;
    return;
  }
  if (
    target === "prod" &&
    !(env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    console.error(
      "[seed-saas-tech-demo] SKIP: Missing PROD_NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
    );
    process.exitCode = 2;
    return;
  }

  let client: Awaited<ReturnType<typeof connectTarget>>["client"] | null = null;
  let via = "";
  try {
    const conn = await connectTarget(target);
    client = conn.client;
    via = conn.via;
  } catch (err) {
    console.error(
      `[seed-saas-tech-demo] SKIP: ${target} connect failed:`,
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 2;
    return;
  }

  console.log(`[seed-saas-tech-demo] connected target=${target} via ${via}`);

  try {
    await client.query("BEGIN");

    const owner = await resolveOwner(client);
    console.log(
      `[seed-saas-tech-demo] owner=${owner.email} is_admin=${owner.isAdmin} is_org_admin=${owner.isOrgAdmin} org=${owner.organizationId}`,
    );
    if (!owner.isAdmin && !owner.isOrgAdmin) {
      throw new Error("resolved owner is not admin/org-admin");
    }

    const existingId = await findExistingDemoWorkspace(client);
    if (existingId) {
      console.log(`[seed-saas-tech-demo] replacing existing workspace ${existingId}`);
      await deleteWorkspaceCascade(client, existingId);
    }

    const workspaceId = randomUUID();
    // workspace_goal holds the success objective text (conversion_goal in pure demo def).
    await client.query(
      `INSERT INTO public.workspaces (
         id, user_id, title, root_topic, status, payment_status,
         description, notes, workspace_goal, source_type,
         organization_id, is_public, is_agent_workspace
       ) VALUES (
         $1, $2, $3, $4, $5, $6,
         $7, $8, $9, $10,
         $11, false, false
       )`,
      [
        workspaceId,
        owner.userId,
        SAAS_TECH_DEMO_WORKSPACE.title,
        SAAS_TECH_DEMO_WORKSPACE.root_topic,
        SAAS_TECH_DEMO_WORKSPACE.status,
        SAAS_TECH_DEMO_WORKSPACE.payment_status,
        SAAS_TECH_DEMO_WORKSPACE.description,
        SAAS_TECH_DEMO_WORKSPACE.notes,
        SAAS_TECH_DEMO_WORKSPACE.conversion_goal,
        SAAS_TECH_DEMO_WORKSPACE.source_type,
        owner.organizationId,
      ],
    );
    console.log(`[seed-saas-tech-demo] workspace_id=${workspaceId}`);

    // Blocks
    const blockIds = new Map<string, string>();
    const blockUuidList: string[] = [];
    for (const block of DEMO_BLOCKS) {
      const id = randomUUID();
      blockIds.set(block.key, id);
      blockUuidList.push(id);
      await client.query(
        `INSERT INTO public.blocks (id, workspace_id, title, description, status, is_start, next_block_ids)
         VALUES ($1, $2, $3, $4, 'available', $5, '{}')`,
        [id, workspaceId, block.title, block.description, Boolean(block.is_start)],
      );
    }
    // Wire a simple linear path for authenticity
    for (let i = 0; i < blockUuidList.length - 1; i++) {
      await client.query(`UPDATE public.blocks SET next_block_ids = $1 WHERE id = $2`, [
        [blockUuidList[i + 1]],
        blockUuidList[i],
      ]);
    }
    console.log(`[seed-saas-tech-demo] blocks=${blockUuidList.length}`);

    // Guests (subjects)
    const guestByKey = new Map<string, string>();
    for (const subject of DEMO_SUBJECTS) {
      const guestId = await ensureGuest(client, {
        organizationId: owner.organizationId,
        workspaceId,
        createdBy: owner.userId,
        subject,
      });
      guestByKey.set(subject.key, guestId);
    }
    console.log(`[seed-saas-tech-demo] guest_subjects=${guestByKey.size}`);

    // Encode embeddings (pure) — guests + workspace owner (auth user)
    const encodedGuests = encodeAllDemoSubjects(workspaceId);
    const encodedOwner = encodeDemoOwnerSubject(workspaceId);
    console.log(
      `[seed-saas-tech-demo] owner_subject=${DEMO_OWNER_SUBJECT.key} display=${DEMO_OWNER_SUBJECT.displayName}`,
    );

    // PoW rows (guests)
    let powCount = 0;
    let ownerPowCount = 0;
    for (const enc of encodedGuests) {
      const guestId = guestByKey.get(enc.subject.key)!;
      const sessionStart =
        enc.embedding.as_of_ms -
        Math.max(...enc.subject.powEvents.map((e) => e.offset_ms), 0);
      for (let i = 0; i < enc.subject.powEvents.length; i++) {
        const ev = enc.subject.powEvents[i];
        const blockKey =
          DEMO_BLOCKS[Math.min(i, DEMO_BLOCKS.length - 1)]?.key ?? DEMO_BLOCKS[0].key;
        const blockId = blockIds.get(blockKey) ?? blockUuidList[0];
        const xaiFileId = `file-demo-${SAAS_TECH_DEMO_MARKER.replace(/[^a-z0-9]+/gi, "-")}-${enc.subject.key}-${i}`;
        await client.query(
          `INSERT INTO public.workspace_proof_of_work (
             workspace_id, block_id, proof_of_work_type, file_name, mime_type,
             file_size, xai_file_id, timestamp_ms, chunk_index, metadata,
             tool_name, tool_action, guest_user_id, user_id, organization_id
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10::jsonb,
             $11, $12, $13, NULL, $14
           )`,
          [
            workspaceId,
            blockId,
            ev.proof_of_work_type,
            ev.file_name,
            ev.mime_type,
            1024 + i * 64,
            xaiFileId,
            sessionStart + ev.offset_ms,
            0,
            JSON.stringify({
              ...ev.metadata,
              demo_marker: SAAS_TECH_DEMO_MARKER,
              subject_key: enc.subject.key,
              display_name: enc.subject.displayName,
              role_hint: enc.subject.roleHint,
              subject_kind: "guest",
            }),
            ev.tool_name,
            ev.tool_action,
            guestId,
            owner.organizationId,
          ],
        );
        powCount += 1;
      }
    }

    // PoW rows (owner auth user — user_id set, guest null)
    {
      const enc = encodedOwner;
      const sessionStart =
        enc.embedding.as_of_ms -
        Math.max(...enc.subject.powEvents.map((e) => e.offset_ms), 0);
      for (let i = 0; i < enc.subject.powEvents.length; i++) {
        const ev = enc.subject.powEvents[i];
        const blockKey =
          DEMO_BLOCKS[Math.min(i, DEMO_BLOCKS.length - 1)]?.key ?? DEMO_BLOCKS[0].key;
        const blockId = blockIds.get(blockKey) ?? blockUuidList[0];
        const xaiFileId = `file-demo-${SAAS_TECH_DEMO_MARKER.replace(/[^a-z0-9]+/gi, "-")}-owner-${i}`;
        await client.query(
          `INSERT INTO public.workspace_proof_of_work (
             workspace_id, block_id, proof_of_work_type, file_name, mime_type,
             file_size, xai_file_id, timestamp_ms, chunk_index, metadata,
             tool_name, tool_action, guest_user_id, user_id, organization_id
           ) VALUES (
             $1, $2, $3, $4, $5,
             $6, $7, $8, $9, $10::jsonb,
             $11, $12, NULL, $13, $14
           )`,
          [
            workspaceId,
            blockId,
            ev.proof_of_work_type,
            ev.file_name,
            ev.mime_type,
            1024 + i * 64,
            xaiFileId,
            sessionStart + ev.offset_ms,
            0,
            JSON.stringify({
              ...ev.metadata,
              demo_marker: SAAS_TECH_DEMO_MARKER,
              subject_key: enc.subject.key,
              display_name: enc.subject.displayName,
              role_hint: enc.subject.roleHint,
              subject_kind: "owner_user",
              is_owner_user: true,
              owner_email: owner.email,
            }),
            ev.tool_name,
            ev.tool_action,
            owner.userId,
            owner.organizationId,
          ],
        );
        powCount += 1;
        ownerPowCount += 1;
      }
    }
    console.log(
      `[seed-saas-tech-demo] pow_rows=${powCount} owner_pow_rows=${ownerPowCount} guest_pow_rows=${powCount - ownerPowCount}`,
    );

    // Knowledge config snapshots (guests)
    let snapCount = 0;
    let ownerSnapCount = 0;
    for (const enc of encodedGuests) {
      const guestId = guestByKey.get(enc.subject.key)!;
      await client.query(
        `INSERT INTO public.knowledge_config_snapshots (
           workspace_id, subject_guest_user_id, subject_user_id,
           embedding_model_id, dim, vector, as_of_ms, pow_event_count,
           confidence, trigger
         ) VALUES (
           $1, $2, NULL,
           $3, $4, $5::jsonb, $6, $7,
           $8, 'recompute'
         )`,
        [
          workspaceId,
          guestId,
          KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          KNOWLEDGE_CONFIG_DIM,
          JSON.stringify(enc.vector),
          enc.embedding.as_of_ms,
          enc.embedding.pow_event_count,
          enc.embedding.confidence,
        ],
      );
      snapCount += 1;
    }

    // Owner snapshot: subject_user_id = owner, guest null
    await client.query(
      `INSERT INTO public.knowledge_config_snapshots (
         workspace_id, subject_guest_user_id, subject_user_id,
         embedding_model_id, dim, vector, as_of_ms, pow_event_count,
         confidence, trigger
       ) VALUES (
         $1, NULL, $2,
         $3, $4, $5::jsonb, $6, $7,
         $8, 'recompute'
       )`,
      [
        workspaceId,
        owner.userId,
        KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
        KNOWLEDGE_CONFIG_DIM,
        JSON.stringify(encodedOwner.vector),
        encodedOwner.embedding.as_of_ms,
        encodedOwner.embedding.pow_event_count,
        encodedOwner.embedding.confidence,
      ],
    );
    snapCount += 1;
    ownerSnapCount = 1;
    console.log(
      `[seed-saas-tech-demo] knowledge_config_snapshots=${snapCount} owner_snapshots=${ownerSnapCount}`,
    );

    // Role regions (synthetic tag)
    const roleRegions = DEMO_ROLE_REGIONS.map((role) => ({
      roleKey: role.key,
      model: buildRoleRegion(role, workspaceId),
      description: role.description,
    }));
    for (const { model, description } of roleRegions) {
      await client.query(
        `INSERT INTO public.custom_verification_models (
           workspace_id, name, description, embedding_model_id, dim,
           centroid, cohort_cohesion, mean_radius, cosine_threshold,
           subject_count, subjects, created_by
         ) VALUES (
           $1, $2, $3, $4, $5,
           $6::jsonb, $7, $8, $9,
           $10, $11::jsonb, $12
         )`,
        [
          workspaceId,
          model.name,
          description,
          model.embedding_model_id,
          model.dim,
          JSON.stringify(model.centroid),
          model.cohort_cohesion,
          model.mean_radius,
          model.cosine_threshold,
          model.subject_count,
          JSON.stringify(model.subjects),
          owner.userId,
        ],
      );
    }
    console.log(`[seed-saas-tech-demo] role_regions=${roleRegions.length}`);

    // Cohort region from user PoW
    const cohort = buildDemoCohortRegion(encodedGuests, (key) => {
      const s = encodedGuests.find((e) => e.subject.key === key)!.subject;
      return {
        label: s.displayName,
        guest_user_id: guestByKey.get(key)!,
        user_id: null,
      };
    });
    await client.query(
      `INSERT INTO public.custom_verification_models (
         workspace_id, name, description, embedding_model_id, dim,
         centroid, cohort_cohesion, mean_radius, cosine_threshold,
         subject_count, subjects, created_by
       ) VALUES (
         $1, $2, $3, $4, $5,
         $6::jsonb, $7, $8, $9,
         $10, $11::jsonb, $12
       )`,
      [
        workspaceId,
        cohort.name,
        DEMO_COHORT_REGION.description,
        cohort.embedding_model_id,
        cohort.dim,
        JSON.stringify(cohort.centroid),
        cohort.cohort_cohesion,
        cohort.mean_radius,
        cohort.cosine_threshold,
        cohort.subject_count,
        JSON.stringify(cohort.subjects),
        owner.userId,
      ],
    );
    console.log(`[seed-saas-tech-demo] cohort_region=${cohort.name}`);

    // Membership summary (pure, same path as unit tests)
    const membership = scoreSubjectsAgainstRoleRegions(
      encodedGuests,
      roleRegions.map((r) => ({ roleKey: r.roleKey, model: r.model })),
    );
    const mixed = assertMixedRoleMembership(membership);
    console.log(
      `[seed-saas-tech-demo] membership in_region=${mixed.inRegion.length} out_of_region=${mixed.outOfRegion.length}`,
    );
    for (const row of mixed.inRegion.slice(0, 4)) {
      console.log(
        `  IN  ${row.displayName} @ ${row.regionName} cos=${row.score.cosine_similarity.toFixed(3)}`,
      );
    }
    for (const row of mixed.outOfRegion.slice(0, 4)) {
      console.log(
        `  OUT ${row.displayName} @ ${row.regionName} cos=${row.score.cosine_similarity.toFixed(3)}`,
      );
    }

    await client.query("COMMIT");

    console.log("[seed-saas-tech-demo] SUCCESS");
    console.log(
      JSON.stringify(
        {
          success: true,
          target,
          workspace_id: workspaceId,
          title: SAAS_TECH_DEMO_WORKSPACE.title,
          owner_email: owner.email,
          owner_is_admin: owner.isAdmin,
          owner_is_org_admin: owner.isOrgAdmin,
          presentation: "regular_workspace",
          marker: SAAS_TECH_DEMO_MARKER,
          guest_subjects: DEMO_SUBJECTS.length,
          owner_subject: DEMO_OWNER_SUBJECT.key,
          owner_user_id: owner.userId,
          pow_rows: powCount,
          owner_pow_rows: ownerPowCount,
          snapshots: snapCount,
          owner_snapshots: ownerSnapCount,
          role_regions: roleRegions.map((r) => r.model.name),
          cohort_region: cohort.name,
          in_region_pairs: mixed.inRegion.length,
          out_of_region_pairs: mixed.outOfRegion.length,
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
        },
        null,
        2,
      ),
    );
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[seed-saas-tech-demo] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

// Entry script: always run (target parser lives in saas-tech-demo-target.ts).
void main();
