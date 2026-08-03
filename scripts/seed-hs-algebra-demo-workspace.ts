/**
 * Seed the Highschool Algebra demo workspace with:
 *  - authentic HS algebra copy + blocks
 *  - multi-guest PoW rows (tool + screen, algebra tools)
 *  - knowledge_config_snapshots (real encoder vectors)
 *  - exactly 2 synthetic knowledge regions (foundations + advanced procedures)
 *
 * SAFETY: default target is staging. Production only when explicitly requested:
 *   --target=prod
 * Refuses unknown targets.
 *
 * Usage:
 *   # staging (safe default)
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-hs-algebra-demo-workspace.ts
 *   # production (intentional)
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-hs-algebra-demo-workspace.ts --target=prod
 *
 * Idempotent: finds workspace by notes marker HS_ALGEBRA_DEMO_MARKER and replaces it.
 */

import { randomUUID } from "node:crypto";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";
import {
  HS_ALGEBRA_BLOCKS,
  HS_ALGEBRA_DEMO_MARKER,
  HS_ALGEBRA_DEMO_WORKSPACE,
  HS_ALGEBRA_GUESTS,
  HS_ALGEBRA_REGIONS,
  assertHsAlgebraCatalogShape,
  buildAlgebraRegion,
  encodeAllAlgebraGuests,
  hsAlgebraGuestEmail,
  type AlgebraGuestSubject,
} from "../lib/demo/hs-algebra-demo-workspace";
import {
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_DIM,
} from "../lib/knowledge-config";
import {
  parseSaasTechDemoSeedTarget,
  type SaasTechDemoTarget,
} from "./saas-tech-demo-target";

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
    [`%${HS_ALGEBRA_DEMO_MARKER}%`],
  );
  return res.rows[0]?.id ?? null;
}

async function deleteWorkspaceCascade(
  client: { query: (sql: string, params?: unknown[]) => Promise<unknown> },
  workspaceId: string,
) {
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
  await client.query(
    `DELETE FROM public.organization_guest_users
     WHERE workspace_id = $1
        OR (metadata->>'demo_marker' = $2)`,
    [workspaceId, HS_ALGEBRA_DEMO_MARKER],
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
    subject: AlgebraGuestSubject;
  },
): Promise<string> {
  const email = hsAlgebraGuestEmail(options.subject.emailLocalPart);
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
          demo_marker: HS_ALGEBRA_DEMO_MARKER,
          subject_key: options.subject.key,
          display_name: options.subject.displayName,
          region_hint: options.subject.regionHint,
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
        demo_marker: HS_ALGEBRA_DEMO_MARKER,
        subject_key: options.subject.key,
        display_name: options.subject.displayName,
        region_hint: options.subject.regionHint,
      }),
    ],
  );
  return id;
}

async function main() {
  const target = argTarget();
  const shape = assertHsAlgebraCatalogShape();
  console.log(`[seed-hs-algebra-demo] target=${target} marker=${HS_ALGEBRA_DEMO_MARKER}`);
  console.log(
    `[seed-hs-algebra-demo] catalog regions=${shape.regionCount} guests=${shape.guestCount} min_pow=${shape.minPowPerGuest}`,
  );
  if (target === "prod") {
    console.log(
      "[seed-hs-algebra-demo] PRODUCTION WRITE: intentional --target=prod; idempotent on demo marker",
    );
  }

  const env = loadEnvFile(".env.local");
  if (target === "staging" && !env.STAGING_NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[seed-hs-algebra-demo] SKIP: Missing STAGING_NEXT_PUBLIC_SUPABASE_URL");
    process.exitCode = 2;
    return;
  }
  if (
    target === "prod" &&
    !(env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    console.error(
      "[seed-hs-algebra-demo] SKIP: Missing PROD_NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
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
      `[seed-hs-algebra-demo] SKIP: ${target} connect failed:`,
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 2;
    return;
  }

  console.log(`[seed-hs-algebra-demo] connected target=${target} via ${via}`);

  try {
    await client.query("BEGIN");

    const owner = await resolveOwner(client);
    console.log(
      `[seed-hs-algebra-demo] owner=${owner.email} is_admin=${owner.isAdmin} is_org_admin=${owner.isOrgAdmin} org=${owner.organizationId}`,
    );
    if (!owner.isAdmin && !owner.isOrgAdmin) {
      throw new Error("resolved owner is not admin/org-admin");
    }

    const existingId = await findExistingDemoWorkspace(client);
    if (existingId) {
      console.log(`[seed-hs-algebra-demo] replacing existing workspace ${existingId}`);
      await deleteWorkspaceCascade(client, existingId);
    }

    const workspaceId = randomUUID();
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
        HS_ALGEBRA_DEMO_WORKSPACE.title,
        HS_ALGEBRA_DEMO_WORKSPACE.root_topic,
        HS_ALGEBRA_DEMO_WORKSPACE.status,
        HS_ALGEBRA_DEMO_WORKSPACE.payment_status,
        HS_ALGEBRA_DEMO_WORKSPACE.description,
        HS_ALGEBRA_DEMO_WORKSPACE.notes,
        HS_ALGEBRA_DEMO_WORKSPACE.conversion_goal,
        HS_ALGEBRA_DEMO_WORKSPACE.source_type,
        owner.organizationId,
      ],
    );
    console.log(`[seed-hs-algebra-demo] workspace_id=${workspaceId}`);

    const blockIds = new Map<string, string>();
    const blockUuidList: string[] = [];
    for (const block of HS_ALGEBRA_BLOCKS) {
      const id = randomUUID();
      blockIds.set(block.key, id);
      blockUuidList.push(id);
      await client.query(
        `INSERT INTO public.blocks (id, workspace_id, title, description, status, is_start, next_block_ids)
         VALUES ($1, $2, $3, $4, 'available', $5, '{}')`,
        [id, workspaceId, block.title, block.description, Boolean(block.is_start)],
      );
    }
    for (let i = 0; i < blockUuidList.length - 1; i++) {
      await client.query(`UPDATE public.blocks SET next_block_ids = $1 WHERE id = $2`, [
        [blockUuidList[i + 1]],
        blockUuidList[i],
      ]);
    }
    console.log(`[seed-hs-algebra-demo] blocks=${blockUuidList.length}`);

    const guestByKey = new Map<string, string>();
    for (const subject of HS_ALGEBRA_GUESTS) {
      const guestId = await ensureGuest(client, {
        organizationId: owner.organizationId,
        workspaceId,
        createdBy: owner.userId,
        subject,
      });
      guestByKey.set(subject.key, guestId);
    }
    console.log(`[seed-hs-algebra-demo] guest_subjects=${guestByKey.size}`);

    const encodedGuests = encodeAllAlgebraGuests(workspaceId);

    let powCount = 0;
    for (const enc of encodedGuests) {
      const guestId = guestByKey.get(enc.subject.key)!;
      const sessionStart =
        enc.embedding.as_of_ms -
        Math.max(...enc.subject.powEvents.map((e) => e.offset_ms), 0);
      for (let i = 0; i < enc.subject.powEvents.length; i++) {
        const ev = enc.subject.powEvents[i];
        const blockKey =
          HS_ALGEBRA_BLOCKS[Math.min(i, HS_ALGEBRA_BLOCKS.length - 1)]?.key ??
          HS_ALGEBRA_BLOCKS[0].key;
        const blockId = blockIds.get(blockKey) ?? blockUuidList[0];
        const xaiFileId = `file-demo-hs-algebra-${enc.subject.key}-${i}`;
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
              demo_marker: HS_ALGEBRA_DEMO_MARKER,
              subject_key: enc.subject.key,
              display_name: enc.subject.displayName,
              region_hint: enc.subject.regionHint,
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
    console.log(`[seed-hs-algebra-demo] pow_rows=${powCount}`);

    let snapCount = 0;
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
    console.log(`[seed-hs-algebra-demo] knowledge_config_snapshots=${snapCount}`);

    const regionRows = HS_ALGEBRA_REGIONS.map((def) => ({
      def,
      model: buildAlgebraRegion(def, workspaceId),
    }));
    if (regionRows.length !== 2) {
      throw new Error(`expected exactly 2 regions, got ${regionRows.length}`);
    }
    for (const { def, model } of regionRows) {
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
          def.description,
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
    console.log(
      `[seed-hs-algebra-demo] role_regions=${regionRows.length} names=${regionRows.map((r) => r.model.name).join(", ")}`,
    );

    await client.query("COMMIT");

    console.log("[seed-hs-algebra-demo] SUCCESS");
    console.log(
      JSON.stringify(
        {
          success: true,
          target,
          workspace_id: workspaceId,
          title: HS_ALGEBRA_DEMO_WORKSPACE.title,
          owner_email: owner.email,
          owner_is_admin: owner.isAdmin,
          owner_is_org_admin: owner.isOrgAdmin,
          presentation: "regular_workspace",
          marker: HS_ALGEBRA_DEMO_MARKER,
          guest_subjects: HS_ALGEBRA_GUESTS.length,
          guest_count: guestByKey.size,
          pow_rows: powCount,
          snapshots: snapCount,
          region_count: regionRows.length,
          regions: regionRows.map((r) => r.model.name),
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          pin_hint:
            "Dashboard pin is client localStorage (openlesson.dashboard.pinnedWorkspaces.v1:<userId>); use workspace_id above.",
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
    console.error("[seed-hs-algebra-demo] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

void main();
