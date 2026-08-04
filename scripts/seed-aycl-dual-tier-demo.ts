/**
 * Seed two staging AYCL access setups for mode + upgrade testing:
 *  - completed purchase access_tier=learner (practice-only, upgrade-eligible)
 *  - completed purchase access_tier=full (creator tools, not upgrade-eligible)
 *
 * SAFETY: default target is staging. Production only with --target=prod.
 *
 * Idempotent via notes markers + fixed access token hashes.
 *
 * Usage:
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-aycl-dual-tier-demo.ts
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/seed-aycl-dual-tier-demo.ts --target=prod
 */

import { randomUUID } from "node:crypto";
import { connectTarget, loadEnvFile } from "./db-connection.mjs";
import {
  parseSaasTechDemoSeedTarget,
  type SaasTechDemoTarget,
} from "./saas-tech-demo-target";
import {
  AYCL_DEMO_BLOCKS,
  AYCL_DUAL_TIER_DEMO_MARKER,
  ayclDemoLearnUrl,
  assertAyclDualTierDemoExpectations,
  buildAyclDualTierDemoFixtures,
  type AyclDualTierDemoFixture,
} from "../lib/demo/aycl-dual-tier-demo";

type PgClient = {
  query: (
    sql: string,
    params?: unknown[],
  ) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

function argTarget(): SaasTechDemoTarget {
  return parseSaasTechDemoSeedTarget(process.argv);
}

function appBaseUrl(target: SaasTechDemoTarget, env: Record<string, string>): string {
  if (target === "staging") {
    return (
      env.STAGING_NEXT_PUBLIC_APP_URL ||
      env.STAGING_APP_URL ||
      env.NEXT_PUBLIC_APP_URL ||
      "https://staging.uncertain.systems"
    ).replace(/\/$/, "");
  }
  return (env.NEXT_PUBLIC_APP_URL || "https://uncertain.systems").replace(
    /\/$/,
    "",
  );
}

async function resolveOwner(client: PgClient): Promise<{
  userId: string;
  organizationId: string | null;
  email: string;
}> {
  const preferred = await client.query(
    `
    SELECT u.id AS user_id, p.organization_id, u.email, p.is_admin, p.is_org_admin
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.is_admin = true OR (p.is_org_admin = true AND p.organization_id IS NOT NULL)
    ORDER BY
      CASE WHEN p.is_admin = true THEN 0 ELSE 1 END,
      CASE
        WHEN u.email ILIKE 'uncertainsystems@%' THEN 0
        WHEN u.email ILIKE '%proven%' THEN 1
        ELSE 2
      END,
      u.created_at DESC
    LIMIT 1
    `,
  );
  if (!preferred.rows[0]) {
    throw new Error(
      "No admin/org-admin profile found to own AYCL dual-tier demo workspaces",
    );
  }
  return {
    userId: String(preferred.rows[0].user_id),
    organizationId: preferred.rows[0].organization_id
      ? String(preferred.rows[0].organization_id)
      : null,
    email: String(preferred.rows[0].email),
  };
}

async function findWorkspaceByMarker(
  client: PgClient,
  marker: string,
): Promise<string | null> {
  const res = await client.query(
    `SELECT id FROM public.workspaces WHERE notes ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
    [`%${marker}%`],
  );
  return res.rows[0] ? String(res.rows[0].id) : null;
}

async function deleteWorkspaceCascade(
  client: PgClient,
  workspaceId: string,
): Promise<void> {
  // Clear purchase FKs that point at this workspace before delete
  await client.query(
    `UPDATE public.aycl_purchases SET forked_workspace_id = NULL WHERE forked_workspace_id = $1`,
    [workspaceId],
  );
  await client.query(
    `UPDATE public.aycl_purchases SET source_workspace_id = source_workspace_id WHERE source_workspace_id = $1`,
    [workspaceId],
  );
  // If this is a source for other purchases, keep purchases by re-pointing is hard —
  // for demo we only delete fork/catalog we own. Catalog delete restricted if purchases exist.
  const deps = await client.query(
    `SELECT id FROM public.aycl_purchases WHERE source_workspace_id = $1 LIMIT 1`,
    [workspaceId],
  );
  if (deps.rows[0]) {
    // Soft-replace content instead of delete catalog
    await client.query(`DELETE FROM public.blocks WHERE workspace_id = $1`, [
      workspaceId,
    ]);
    return;
  }
  await client.query(`DELETE FROM public.blocks WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.workspaces WHERE id = $1`, [workspaceId]);
}

async function upsertCatalogWorkspace(
  client: PgClient,
  ownerUserId: string,
  fixture: AyclDualTierDemoFixture,
): Promise<string> {
  const existing = await findWorkspaceByMarker(client, fixture.catalogMarker);
  const notes = [
    AYCL_DUAL_TIER_DEMO_MARKER,
    fixture.catalogMarker,
    "Staging dual-tier AYCL demo catalog source.",
  ].join("\n");

  if (existing) {
    await client.query(
      `
      UPDATE public.workspaces SET
        title = $2,
        root_topic = $2,
        description = $3,
        workspace_goal = $4,
        notes = $5,
        is_all_you_can_learn = true,
        is_public = false,
        status = 'active',
        user_id = $6,
        author_id = $6
      WHERE id = $1
      `,
      [
        existing,
        fixture.catalogTitle,
        fixture.catalogDescription,
        fixture.catalogGoal,
        notes,
        ownerUserId,
      ],
    );
    await client.query(`DELETE FROM public.blocks WHERE workspace_id = $1`, [
      existing,
    ]);
    await insertDemoBlocks(client, existing);
    return existing;
  }

  const id = randomUUID();
  await client.query(
    `
    INSERT INTO public.workspaces (
      id, user_id, author_id, title, root_topic, description, workspace_goal,
      notes, status, is_public, is_all_you_can_learn
    ) VALUES (
      $1, $2, $2, $3, $3, $4, $5, $6, 'active', false, true
    )
    `,
    [
      id,
      ownerUserId,
      fixture.catalogTitle,
      fixture.catalogDescription,
      fixture.catalogGoal,
      notes,
    ],
  );
  await insertDemoBlocks(client, id);
  return id;
}

async function insertDemoBlocks(
  client: PgClient,
  workspaceId: string,
): Promise<string[]> {
  const ids = AYCL_DEMO_BLOCKS.map(() => randomUUID());
  for (let i = 0; i < AYCL_DEMO_BLOCKS.length; i++) {
    const b = AYCL_DEMO_BLOCKS[i];
    const next =
      i < AYCL_DEMO_BLOCKS.length - 1 ? [ids[i + 1]] : ([] as string[]);
    await client.query(
      `
      INSERT INTO public.blocks (
        id, workspace_id, title, description, is_start, next_block_ids,
        status, position_x, position_y, span_w, span_h
      ) VALUES (
        $1, $2, $3, $4, $5, $6::uuid[], 'available', $7, $8, 1, 1
      )
      `,
      [
        ids[i],
        workspaceId,
        b.title,
        b.description,
        b.is_start,
        next,
        b.position_x,
        b.position_y,
      ],
    );
  }
  return ids;
}

async function upsertForkWorkspace(
  client: PgClient,
  ownerUserId: string,
  sourceWorkspaceId: string,
  fixture: AyclDualTierDemoFixture,
): Promise<string> {
  const existing = await findWorkspaceByMarker(client, fixture.forkMarker);
  const notes = [
    AYCL_DUAL_TIER_DEMO_MARKER,
    fixture.forkMarker,
    `Fork of ${sourceWorkspaceId}`,
    `access_tier=${fixture.accessTier}`,
  ].join("\n");
  const title = `${fixture.catalogTitle} (private fork)`;

  if (existing) {
    await client.query(
      `
      UPDATE public.workspaces SET
        title = $2,
        root_topic = $2,
        description = $3,
        workspace_goal = $4,
        notes = $5,
        is_all_you_can_learn = false,
        is_public = false,
        status = 'active',
        user_id = $6,
        author_id = $6,
        original_workspace_id = $7
      WHERE id = $1
      `,
      [
        existing,
        title,
        fixture.catalogDescription,
        fixture.catalogGoal,
        notes,
        ownerUserId,
        sourceWorkspaceId,
      ],
    );
    await client.query(`DELETE FROM public.blocks WHERE workspace_id = $1`, [
      existing,
    ]);
    // Copy blocks from current catalog
    await copyBlocks(client, sourceWorkspaceId, existing);
    return existing;
  }

  const id = randomUUID();
  await client.query(
    `
    INSERT INTO public.workspaces (
      id, user_id, author_id, title, root_topic, description, workspace_goal,
      notes, status, is_public, is_all_you_can_learn, original_workspace_id
    ) VALUES (
      $1, $2, $2, $3, $3, $4, $5, $6, 'active', false, false, $7
    )
    `,
    [
      id,
      ownerUserId,
      title,
      fixture.catalogDescription,
      fixture.catalogGoal,
      notes,
      sourceWorkspaceId,
    ],
  );
  await copyBlocks(client, sourceWorkspaceId, id);
  return id;
}

async function copyBlocks(
  client: PgClient,
  sourceId: string,
  destId: string,
): Promise<void> {
  const { rows } = await client.query(
    `
    SELECT id, title, description, is_start, next_block_ids, status,
           position_x, position_y, span_w, span_h, planning_prompt
    FROM public.blocks WHERE workspace_id = $1 ORDER BY position_x NULLS LAST, created_at
    `,
    [sourceId],
  );
  const idMap = new Map<string, string>();
  for (const row of rows) {
    idMap.set(String(row.id), randomUUID());
  }
  for (const row of rows) {
    const newId = idMap.get(String(row.id))!;
    const next = Array.isArray(row.next_block_ids)
      ? (row.next_block_ids as string[])
          .map((x) => idMap.get(String(x)))
          .filter(Boolean)
      : [];
    await client.query(
      `
      INSERT INTO public.blocks (
        id, workspace_id, title, description, is_start, next_block_ids,
        status, position_x, position_y, span_w, span_h, planning_prompt
      ) VALUES (
        $1, $2, $3, $4, $5, $6::uuid[], $7, $8, $9, $10, $11, $12
      )
      `,
      [
        newId,
        destId,
        row.title,
        row.description,
        row.is_start,
        next,
        row.status || "available",
        row.position_x,
        row.position_y,
        row.span_w ?? 1,
        row.span_h ?? 1,
        row.planning_prompt ?? null,
      ],
    );
  }
}

async function upsertPurchase(
  client: PgClient,
  sourceWorkspaceId: string,
  forkedWorkspaceId: string,
  fixture: AyclDualTierDemoFixture,
): Promise<string> {
  // Prefer match by fixed token hash (stable open URL)
  const byToken = await client.query(
    `SELECT id FROM public.aycl_purchases WHERE access_token_hash = $1 LIMIT 1`,
    [fixture.accessTokenHash],
  );
  if (byToken.rows[0]) {
    const id = String(byToken.rows[0].id);
    await client.query(
      `
      UPDATE public.aycl_purchases SET
        source_workspace_id = $2,
        forked_workspace_id = $3,
        status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        purchaser_email = $4,
        access_tier = $5,
        stripe_checkout_session_id = $6
      WHERE id = $1
      `,
      [
        id,
        sourceWorkspaceId,
        forkedWorkspaceId,
        fixture.purchaserEmail,
        fixture.accessTier,
        fixture.stripeCheckoutSessionId,
      ],
    );
    return id;
  }

  // Or match by synthetic stripe session
  const bySession = await client.query(
    `SELECT id FROM public.aycl_purchases WHERE stripe_checkout_session_id = $1 LIMIT 1`,
    [fixture.stripeCheckoutSessionId],
  );
  if (bySession.rows[0]) {
    const id = String(bySession.rows[0].id);
    await client.query(
      `
      UPDATE public.aycl_purchases SET
        source_workspace_id = $2,
        forked_workspace_id = $3,
        access_token_hash = $4,
        status = 'completed',
        completed_at = COALESCE(completed_at, now()),
        purchaser_email = $5,
        access_tier = $6
      WHERE id = $1
      `,
      [
        id,
        sourceWorkspaceId,
        forkedWorkspaceId,
        fixture.accessTokenHash,
        fixture.purchaserEmail,
        fixture.accessTier,
      ],
    );
    return id;
  }

  const id = randomUUID();
  await client.query(
    `
    INSERT INTO public.aycl_purchases (
      id, source_workspace_id, forked_workspace_id, access_token_hash,
      stripe_checkout_session_id, purchaser_email, status, access_tier, completed_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, 'completed', $7, now()
    )
    `,
    [
      id,
      sourceWorkspaceId,
      forkedWorkspaceId,
      fixture.accessTokenHash,
      fixture.stripeCheckoutSessionId,
      fixture.purchaserEmail,
      fixture.accessTier,
    ],
  );
  return id;
}

async function loadPurchaseRow(client: PgClient, purchaseId: string) {
  const res = await client.query(
    `
    SELECT p.id, p.status, p.access_tier, p.forked_workspace_id, p.source_workspace_id,
           p.access_token_hash, p.purchaser_email,
           s.is_all_you_can_learn AS source_is_aycl
    FROM public.aycl_purchases p
    JOIN public.workspaces s ON s.id = p.source_workspace_id
    WHERE p.id = $1
    `,
    [purchaseId],
  );
  return res.rows[0] || null;
}

async function main() {
  const target = argTarget();
  if (target === "prod") {
    console.error(
      "Refusing to seed AYCL dual-tier demo on prod unless you re-run with explicit intent.",
    );
    console.error(
      "This script is for staging mode testing. Pass --target=staging (default).",
    );
    // Still allow --target=prod if user insists (parse already accepted it) — warn loudly
    console.warn("Continuing on prod because --target=prod was passed explicitly.");
  }

  loadEnvFile(".env.local");
  const env = {
    ...process.env,
    ...loadEnvFile(".env.local"),
  } as Record<string, string>;

  const baseUrl = appBaseUrl(target, env);
  const fixtures = buildAyclDualTierDemoFixtures();

  console.log(`Target: ${target}`);
  console.log(`Marker: ${AYCL_DUAL_TIER_DEMO_MARKER}`);

  const { client, via } = await connectTarget(target);
  console.log(`Connected via ${via}`);

  try {
    const owner = await resolveOwner(client as PgClient);
    console.log(`Owner: ${owner.email} (${owner.userId})`);

    const results: Array<{
      kind: string;
      catalogId: string;
      forkId: string;
      purchaseId: string;
      accessTier: string;
      learnUrl: string;
      accessToken: string;
    }> = [];

    for (const fixture of [fixtures.learner, fixtures.full]) {
      console.log(`\n── Seeding ${fixture.kind} tier ──`);
      const catalogId = await upsertCatalogWorkspace(
        client as PgClient,
        owner.userId,
        fixture,
      );
      console.log(`  catalog workspace: ${catalogId}`);

      const forkId = await upsertForkWorkspace(
        client as PgClient,
        owner.userId,
        catalogId,
        fixture,
      );
      console.log(`  forked workspace:  ${forkId}`);

      const purchaseId = await upsertPurchase(
        client as PgClient,
        catalogId,
        forkId,
        fixture,
      );
      console.log(`  purchase:          ${purchaseId}`);
      console.log(`  access_tier:       ${fixture.accessTier}`);
      console.log(`  learn URL:         ${ayclDemoLearnUrl(baseUrl, fixture.accessToken)}`);

      results.push({
        kind: fixture.kind,
        catalogId,
        forkId,
        purchaseId,
        accessTier: fixture.accessTier,
        learnUrl: ayclDemoLearnUrl(baseUrl, fixture.accessToken),
        accessToken: fixture.accessToken,
      });
    }

    // Verify expectations against DB
    const learnerRow = await loadPurchaseRow(
      client as PgClient,
      results.find((r) => r.kind === "learner")!.purchaseId,
    );
    const fullRow = await loadPurchaseRow(
      client as PgClient,
      results.find((r) => r.kind === "full")!.purchaseId,
    );
    if (!learnerRow || !fullRow) {
      throw new Error("Failed to reload purchase rows after seed");
    }

    const check = assertAyclDualTierDemoExpectations({
      learner: {
        status: String(learnerRow.status),
        access_tier: String(learnerRow.access_tier),
        forked_workspace_id: learnerRow.forked_workspace_id
          ? String(learnerRow.forked_workspace_id)
          : null,
        source_is_aycl: Boolean(learnerRow.source_is_aycl),
      },
      full: {
        status: String(fullRow.status),
        access_tier: String(fullRow.access_tier),
        forked_workspace_id: fullRow.forked_workspace_id
          ? String(fullRow.forked_workspace_id)
          : null,
        source_is_aycl: Boolean(fullRow.source_is_aycl),
      },
    });

    if (!check.ok) {
      throw new Error(`Post-seed assertions failed: ${check.errors.join("; ")}`);
    }

    console.log("\n════════ AYCL dual-tier demo ready ════════");
    console.log("LEARNER (practice-only, upgrade-eligible):");
    console.log(`  token:     ${fixtures.learner.accessToken}`);
    console.log(`  URL:       ${ayclDemoLearnUrl(baseUrl, fixtures.learner.accessToken)}`);
    console.log(`  fork id:   ${results.find((r) => r.kind === "learner")!.forkId}`);
    console.log(`  purchase:  ${results.find((r) => r.kind === "learner")!.purchaseId}`);
    console.log("FULL / CREATOR (no upgrade CTA):");
    console.log(`  token:     ${fixtures.full.accessToken}`);
    console.log(`  URL:       ${ayclDemoLearnUrl(baseUrl, fixtures.full.accessToken)}`);
    console.log(`  fork id:   ${results.find((r) => r.kind === "full")!.forkId}`);
    console.log(`  purchase:  ${results.find((r) => r.kind === "full")!.purchaseId}`);
    console.log("Catalog sources appear on /all-you-can-learn when is_all_you_can_learn=true.");
    console.log("Upgrade path: open learner URL → use in-product upgrade checkout (eligible).");
    console.log("═══════════════════════════════════════════\n");
  } finally {
    await (client as PgClient).end();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
