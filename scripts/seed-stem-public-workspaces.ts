/**
 * Seed public admin-owned STEM workspaces + first-layer subdiscipline knowledge regions.
 *
 * SAFETY: default target is staging. Production only when explicitly requested:
 *   --target=prod
 *
 * Idempotent: each field is marked in notes with STEM_PUBLIC_CATALOG_MARKER + STEM_FIELD:<key>.
 * Re-runs update/replace that field's workspace (delete cascade + recreate).
 *
 * Usage:
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-stem-public-workspaces.ts
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-stem-public-workspaces.ts --target=prod
 */

import { randomUUID } from "node:crypto";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";
import {
  STEM_PUBLIC_CATALOG_MARKER,
  STEM_PUBLIC_FIELDS,
  assertStemCatalogComplete,
  blocksForStemField,
  buildAllStemRegionsForField,
  stemFieldNotesMarker,
  stemWorkspaceNotes,
  type StemFieldDefinition,
} from "../lib/demo/stem-public-workspaces";
import { parseSaasTechDemoSeedTarget, type SaasTechDemoTarget } from "./saas-tech-demo-target";

function argTarget(): SaasTechDemoTarget {
  return parseSaasTechDemoSeedTarget(process.argv);
}

async function resolveAdminOwner(client: {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
}): Promise<{
  userId: string;
  organizationId: string | null;
  email: string;
  isAdmin: boolean;
}> {
  // Prefer platform admin; org optional but preferred when present.
  const preferred = await client.query(
    `
    SELECT u.id AS user_id, p.organization_id, u.email, p.is_admin, p.is_org_admin
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.is_admin = true
    ORDER BY
      CASE WHEN p.organization_id IS NOT NULL THEN 0 ELSE 1 END,
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
      organizationId: preferred.rows[0].organization_id
        ? String(preferred.rows[0].organization_id)
        : null,
      email: String(preferred.rows[0].email),
      isAdmin: Boolean(preferred.rows[0].is_admin),
    };
  }

  // Fallback: org admin if no platform admin exists
  const orgAdmin = await client.query(
    `
    SELECT u.id AS user_id, p.organization_id, u.email, p.is_admin, p.is_org_admin
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.is_org_admin = true AND p.organization_id IS NOT NULL
    ORDER BY u.created_at DESC
    LIMIT 1
    `,
  );
  if (orgAdmin.rows[0]) {
    return {
      userId: String(orgAdmin.rows[0].user_id),
      organizationId: String(orgAdmin.rows[0].organization_id),
      email: String(orgAdmin.rows[0].email),
      isAdmin: Boolean(orgAdmin.rows[0].is_admin),
    };
  }

  throw new Error("No admin (is_admin) profile found to own STEM public workspaces");
}

async function findFieldWorkspace(
  client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<{ id: string }> }>;
  },
  fieldKey: string,
): Promise<string | null> {
  const res = await client.query(
    `SELECT id FROM public.workspaces
     WHERE notes ILIKE $1
     ORDER BY created_at DESC
     LIMIT 1`,
    [`%${stemFieldNotesMarker(fieldKey)}%`],
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
  await client.query(`DELETE FROM public.workspaces WHERE id = $1`, [workspaceId]);
}

async function seedField(
  client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  },
  owner: { userId: string; organizationId: string | null },
  field: StemFieldDefinition,
): Promise<{
  workspaceId: string;
  regionCount: number;
  blockCount: number;
  replaced: boolean;
}> {
  const existingId = await findFieldWorkspace(client, field.key);
  let replaced = false;
  if (existingId) {
    await deleteWorkspaceCascade(client, existingId);
    replaced = true;
  }

  const workspaceId = randomUUID();
  await client.query(
    `INSERT INTO public.workspaces (
       id, user_id, title, root_topic, status, payment_status,
       description, notes, workspace_goal, source_type,
       organization_id, is_public, is_agent_workspace
     ) VALUES (
       $1, $2, $3, $4, 'active', 'paid',
       $5, $6, $7, 'topic',
       $8, true, false
     )`,
    [
      workspaceId,
      owner.userId,
      field.title,
      field.root_topic,
      field.description,
      stemWorkspaceNotes(field),
      field.workspace_goal,
      owner.organizationId,
    ],
  );

  // One block per expert region (subdiscipline) — Map placement lists these.
  const blockDefs = blocksForStemField(field);
  const blockIds: string[] = [];
  for (const block of blockDefs) {
    const blockId = randomUUID();
    blockIds.push(blockId);
    await client.query(
      `INSERT INTO public.blocks (id, workspace_id, title, description, status, is_start, next_block_ids)
       VALUES ($1, $2, $3, $4, 'available', $5, '{}')`,
      [blockId, workspaceId, block.title, block.description, block.is_start],
    );
  }
  // Simple linear path through subdiscipline blocks
  for (let i = 0; i < blockIds.length - 1; i++) {
    await client.query(`UPDATE public.blocks SET next_block_ids = $1 WHERE id = $2`, [
      [blockIds[i + 1]],
      blockIds[i],
    ]);
  }

  const regions = buildAllStemRegionsForField(field, workspaceId);
  if (regions.length !== blockDefs.length) {
    throw new Error(
      `field ${field.key}: regions ${regions.length} != blocks ${blockDefs.length}`,
    );
  }
  for (let i = 0; i < regions.length; i++) {
    const model = regions[i];
    const sub = field.subdisciplines[i];
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
        sub.description,
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

  return {
    workspaceId,
    regionCount: regions.length,
    blockCount: blockDefs.length,
    replaced,
  };
}

async function main() {
  const target = argTarget();
  console.log(
    `[seed-stem-public] target=${target} marker=${STEM_PUBLIC_CATALOG_MARKER} fields=${STEM_PUBLIC_FIELDS.length}`,
  );
  if (target === "prod") {
    console.log(
      "[seed-stem-public] PRODUCTION WRITE: intentional --target=prod; idempotent per STEM_FIELD marker",
    );
  }

  // Pure catalog guard before any DB write
  const catalog = assertStemCatalogComplete();
  console.log(
    `[seed-stem-public] catalog ok fields=${catalog.fieldCount} min_regions=${catalog.minRegionsPerField}`,
  );

  const env = loadEnvFile(".env.local");
  if (target === "staging" && !env.STAGING_NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[seed-stem-public] SKIP: Missing STAGING_NEXT_PUBLIC_SUPABASE_URL");
    process.exitCode = 2;
    return;
  }
  if (
    target === "prod" &&
    !(env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    console.error(
      "[seed-stem-public] SKIP: Missing PROD_NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
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
      `[seed-stem-public] SKIP: ${target} connect failed:`,
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 2;
    return;
  }

  console.log(`[seed-stem-public] connected target=${target} via ${via}`);

  try {
    await client.query("BEGIN");
    const owner = await resolveAdminOwner(client);
    console.log(
      `[seed-stem-public] owner=${owner.email} is_admin=${owner.isAdmin} org=${owner.organizationId ?? "none"}`,
    );
    if (!owner.isAdmin) {
      throw new Error(`resolved owner ${owner.email} is not is_admin=true`);
    }

    const results: Array<{
      key: string;
      title: string;
      workspaceId: string;
      regionCount: number;
      blockCount: number;
      replaced: boolean;
    }> = [];

    for (const field of STEM_PUBLIC_FIELDS) {
      const seeded = await seedField(client, owner, field);
      results.push({
        key: field.key,
        title: field.title,
        workspaceId: seeded.workspaceId,
        regionCount: seeded.regionCount,
        blockCount: seeded.blockCount,
        replaced: seeded.replaced,
      });
      console.log(
        `[seed-stem-public] field=${field.key} title=${field.title} workspace_id=${seeded.workspaceId} regions=${seeded.regionCount} blocks=${seeded.blockCount} replaced=${seeded.replaced} is_public=true`,
      );
    }

    await client.query("COMMIT");
    console.log(`[seed-stem-public] COMMIT ok fields=${results.length}`);
    for (const r of results) {
      console.log(
        `  ${r.key}\t${r.workspaceId}\tregions=${r.regionCount}\tblocks=${r.blockCount}\t${r.replaced ? "replaced" : "created"}`,
      );
    }
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[seed-stem-public] FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

main();
