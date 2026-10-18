/**
 * Seed hardcoded landing featured maps (workspace + blocks) with stable UUID v5 IDs.
 *
 * SAFETY: default target is staging. Production only with --target=prod.
 * Idempotent on workspace id (and notes marker).
 *
 * Usage:
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-landing-featured-maps.ts
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-landing-featured-maps.ts --target=prod
 */

import { connectTarget, loadEnvFile } from "./db-connection.mjs";
import {
  LANDING_FEATURED_MAPS,
  LANDING_FEATURED_NOTES_MARKER,
  assertLandingFeaturedCatalog,
} from "../lib/marketing/landing-featured-maps";
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
}> {
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
    };
  }
  throw new Error("No admin (is_admin) profile found to own landing featured maps");
}

async function seedMap(
  client: {
    query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  },
  owner: { userId: string; organizationId: string | null },
  map: (typeof LANDING_FEATURED_MAPS)[number],
): Promise<{ replaced: boolean }> {
  const existing = await client.query(`SELECT id FROM public.workspaces WHERE id = $1 LIMIT 1`, [
    map.id,
  ]);
  const replaced = Boolean(existing.rows[0]);

  await client.query(
    `
    INSERT INTO public.workspaces (
      id, user_id, author_id, title, root_topic, status, payment_status,
      description, notes, workspace_goal, source_type,
      organization_id, is_public, is_agent_workspace, is_all_you_can_learn,
      is_play_copy, workspace_kind, aycl_category, aycl_summary
    ) VALUES (
      $1, $2, $2, $3, $3, 'active', 'paid',
      $4, $5, $6, 'topic',
      $7, true, false, false,
      false, 'standard', $8, $9
    )
    ON CONFLICT (id) DO UPDATE SET
      title = EXCLUDED.title,
      root_topic = EXCLUDED.root_topic,
      description = EXCLUDED.description,
      notes = EXCLUDED.notes,
      workspace_goal = EXCLUDED.workspace_goal,
      is_public = true,
      is_play_copy = false,
      is_all_you_can_learn = false,
      workspace_kind = 'standard',
      aycl_category = EXCLUDED.aycl_category,
      aycl_summary = EXCLUDED.aycl_summary
    `,
    [
      map.id,
      owner.userId,
      map.title,
      map.description,
      map.notesMarker,
      map.goal,
      owner.organizationId,
      map.category,
      map.summary,
    ],
  );

  await client.query(`DELETE FROM public.blocks WHERE workspace_id = $1`, [map.id]);

  const keyToId = new Map(map.blocks.map((block) => [block.key, block.id]));
  for (const block of map.blocks) {
    const nextIds = block.next
      .map((key) => keyToId.get(key))
      .filter((id): id is string => Boolean(id));
    await client.query(
      `
      INSERT INTO public.blocks (
        id, workspace_id, title, description, status, is_start,
        next_block_ids, position_x, position_y
      ) VALUES (
        $1, $2, $3, $4, 'available', $5,
        $6::uuid[], $7, $8
      )
      `,
      [
        block.id,
        map.id,
        block.title,
        block.description,
        Boolean(block.isStart),
        nextIds,
        block.x,
        block.y,
      ],
    );
  }

  return { replaced };
}

async function main() {
  const target = argTarget();
  const catalog = assertLandingFeaturedCatalog();
  console.log(
    `[seed-landing-featured] target=${target} marker=${LANDING_FEATURED_NOTES_MARKER} maps=${catalog.mapCount} blocks=${catalog.blockCount}`,
  );
  if (target === "prod") {
    console.log(
      "[seed-landing-featured] PRODUCTION WRITE: intentional --target=prod; idempotent on hardcoded ids",
    );
  }

  const env = loadEnvFile(".env.local");
  if (target === "staging" && !env.STAGING_NEXT_PUBLIC_SUPABASE_URL) {
    console.error("[seed-landing-featured] SKIP: Missing STAGING_NEXT_PUBLIC_SUPABASE_URL");
    process.exitCode = 2;
    return;
  }
  if (
    target === "prod" &&
    !(env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL)
  ) {
    console.error(
      "[seed-landing-featured] SKIP: Missing PROD_NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL",
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
      `[seed-landing-featured] SKIP: ${target} connect failed:`,
      err instanceof Error ? err.message : err,
    );
    process.exitCode = 2;
    return;
  }

  console.log(`[seed-landing-featured] connected target=${target} via ${via}`);

  try {
    await client.query("BEGIN");
    const owner = await resolveAdminOwner(client);
    console.log(
      `[seed-landing-featured] owner=${owner.email} org=${owner.organizationId ?? "none"}`,
    );

    for (const map of LANDING_FEATURED_MAPS) {
      const { replaced } = await seedMap(client, owner, map);
      console.log(
        `[seed-landing-featured] ${replaced ? "replaced" : "created"} ${map.slug} ${map.id} blocks=${map.blocks.length}`,
      );
    }

    await client.query("COMMIT");
    console.log(`[seed-landing-featured] COMMIT ok maps=${LANDING_FEATURED_MAPS.length}`);
  } catch (err) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    console.error("[seed-landing-featured] FAILED:", err instanceof Error ? err.message : err);
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
