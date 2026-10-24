/**
 * Seed two Verification and two Calibration Data Studio demo sets into
 * production. Idempotent on per-set notes markers.
 *
 * Usage:
 *   npm run db:seed-production-studio-demos -- --target=prod
 *   npm run db:seed-production-studio-demos -- --target=prod --email=you@example.com
 */

import { randomUUID } from "node:crypto";
import { connectTarget, loadEnvFile, projectRefFromUrl } from "./db-connection.mjs";
import {
  PRODUCTION_STUDIO_DEMO_MARKER,
  PRODUCTION_STUDIO_DEMO_SETS,
  buildStudioDemoRegion,
  encodeStudioDemoRuns,
  studioDemoCalibrationEvents,
  type StudioDemoSetDef,
} from "../lib/demo/production-studio-demo-sets";
import { FLOW_EMBEDDING_DIM, FLOW_EMBEDDING_MODEL_ID } from "../lib/flow-embedding";

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
  end: () => Promise<void>;
};

function argEmail(argv: string[] = process.argv): string {
  const raw = argv.find((arg) => arg.startsWith("--email="))?.slice("--email=".length);
  return String(raw || "").trim().toLowerCase();
}

function argTarget(argv: string[] = process.argv): "prod" {
  const raw = argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
  if (raw === "prod" || raw === "production") return "prod";
  throw new Error(
    'Refusing to run without --target=prod. This seed writes production Data Studio demos.',
  );
}

async function resolveOwner(
  client: PgClient,
  email: string,
): Promise<{ userId: string; organizationId: string; email: string }> {
  if (email) {
    const named = await client.query(
      `
      SELECT u.id AS user_id, p.organization_id, u.email
      FROM auth.users u
      JOIN public.profiles p ON p.id = u.id
      WHERE lower(u.email) = $1
      LIMIT 1
      `,
      [email],
    );
    if (!named.rows[0]?.user_id || !named.rows[0]?.organization_id) {
      throw new Error(`No profile with organization_id for ${email}`);
    }
    return {
      userId: String(named.rows[0].user_id),
      organizationId: String(named.rows[0].organization_id),
      email: String(named.rows[0].email),
    };
  }
  const preferred = await client.query(
    `
    SELECT u.id AS user_id, p.organization_id, u.email
    FROM auth.users u
    JOIN public.profiles p ON p.id = u.id
    WHERE p.organization_id IS NOT NULL
    ORDER BY
      CASE
        WHEN u.email ILIKE 'uncertainsystems@%' THEN 0
        WHEN u.email ILIKE '%dncolomer%' THEN 1
        WHEN p.is_admin = true THEN 2
        WHEN p.is_org_admin = true THEN 3
        ELSE 4
      END,
      u.created_at DESC
    LIMIT 1
    `,
  );
  if (!preferred.rows[0]?.user_id || !preferred.rows[0]?.organization_id) {
    throw new Error("No profile with organization_id found to own the demo workspaces");
  }
  return {
    userId: String(preferred.rows[0].user_id),
    organizationId: String(preferred.rows[0].organization_id),
    email: String(preferred.rows[0].email),
  };
}

async function deleteWorkspaceCascade(client: PgClient, workspaceId: string) {
  await client.query(`DELETE FROM public.custom_verification_models WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.workspace_flow_embeddings WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.workspace_proof_of_work WHERE workspace_id = $1`, [
    workspaceId,
  ]);
  await client.query(`DELETE FROM public.workspaces WHERE id = $1`, [workspaceId]);
}

async function seedSet(
  client: PgClient,
  owner: { userId: string; organizationId: string; email: string },
  set: StudioDemoSetDef,
): Promise<{ workspaceId: string; flowId: string; publicToken: string; runCount: number }> {
  const existing = await client.query(
    `SELECT id FROM public.workspaces WHERE notes ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
    [`%${set.marker}%`],
  );
  const existingId = existing.rows[0]?.id ? String(existing.rows[0].id) : null;
  if (existingId) {
    console.log(`[seed-prod-studio] replacing ${set.id} workspace ${existingId}`);
    await deleteWorkspaceCascade(client, existingId);
  }

  const workspaceId = randomUUID();
  const workspaceKind = set.product === "calibration" ? "calibration" : "knowledge_region";
  await client.query(
    `INSERT INTO public.workspaces (
       id, user_id, author_id, title, root_topic, status, payment_status,
       description, notes, workspace_goal, source_type,
       organization_id, is_public, is_agent_workspace, workspace_kind
     ) VALUES (
       $1, $2, $2, $3, $4, 'active', 'paid',
       $5, $6, $7, 'topic',
       $8, false, false, $9
     )`,
    [
      workspaceId,
      owner.userId,
      set.title,
      set.topic,
      set.description,
      `${set.marker} ${PRODUCTION_STUDIO_DEMO_MARKER} Production Data Studio sample.`,
      set.goal,
      owner.organizationId,
      workspaceKind,
    ],
  );

  const flowId = randomUUID();
  const publicToken = `${set.publicTokenPrefix}-${flowId.slice(0, 8)}`;
  if (set.product === "verification") {
    await client.query(
      `INSERT INTO public.workspace_verification_flows (
         id, workspace_id, name, topic, questions, duration_minutes, action_catalog, public_token
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        flowId,
        workspaceId,
        set.flowName,
        set.topic,
        JSON.stringify(set.questions),
        set.durationMinutes,
        set.actionCatalog,
        publicToken,
      ],
    );
  } else {
    await client.query(
      `INSERT INTO public.workspace_calibration_flows (
         id, workspace_id, name, goal, questions, duration_minutes, action_catalog, public_token
       ) VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8)`,
      [
        flowId,
        workspaceId,
        set.flowName,
        set.goal,
        JSON.stringify(set.questions),
        set.durationMinutes,
        set.actionCatalog,
        publicToken,
      ],
    );
  }

  const encoded = encodeStudioDemoRuns(set);
  const region = buildStudioDemoRegion(set, encoded);
  const now = Date.now();
  const flowKind = set.flowKind;

  for (const [index, run] of encoded.entries()) {
    const runId = randomUUID();
    const createdAt = new Date(now - (encoded.length - index) * 60_000).toISOString();
    if (set.product === "verification") {
      await client.query(
        `INSERT INTO public.workspace_verification_identities (flow_id, identity) VALUES ($1, $2)`,
        [flowId, run.identity],
      );
      await client.query(
        `INSERT INTO public.workspace_verification_results (
           id, flow_id, workspace_id, identity, source, question_id, prompt, embedding, created_at
         ) VALUES ($1, $2, $3, $4, 'runner', $5, $6, $7::jsonb, $8)`,
        [
          runId,
          flowId,
          workspaceId,
          run.identity,
          set.questions[0]?.id ?? null,
          run.speech,
          JSON.stringify(run.embedding.vector),
          createdAt,
        ],
      );
    } else {
      await client.query(
        `INSERT INTO public.workspace_calibration_identities (flow_id, identity) VALUES ($1, $2)`,
        [flowId, run.identity],
      );
      await client.query(
        `INSERT INTO public.workspace_calibration_proofs (
           id, flow_id, workspace_id, identity, events, created_at
         ) VALUES ($1, $2, $3, $4, $5::jsonb, $6)`,
        [
          runId,
          flowId,
          workspaceId,
          run.identity,
          JSON.stringify(studioDemoCalibrationEvents(run)),
          createdAt,
        ],
      );
    }

    await client.query(
      `INSERT INTO public.workspace_flow_embeddings (
         id, workspace_id, flow_kind, flow_id, run_id, identity, source,
         embedding_model_id, dim, vector, raw, created_at
       ) VALUES (
         $1, $2, $3, $4, $5, $6, 'runner',
         $7, $8, $9::jsonb, $10::jsonb, $11
       )`,
      [
        randomUUID(),
        workspaceId,
        flowKind,
        flowId,
        runId,
        run.identity,
        FLOW_EMBEDDING_MODEL_ID,
        FLOW_EMBEDDING_DIM,
        JSON.stringify(run.embedding.vector),
        JSON.stringify(run.embedding.raw),
        createdAt,
      ],
    );
    await client.query(
      `INSERT INTO public.workspace_proof_of_work (
         workspace_id, proof_of_work_type, file_name, mime_type,
         file_size, xai_file_id, timestamp_ms, chunk_index, metadata,
         tool_name, tool_action, user_id, organization_id
       ) VALUES (
         $1, 'tool', $2, 'text/plain',
         $3, $4, $5, 0, $6::jsonb,
         'speech-segment', 'speech_stop', $7, $8
       )`,
      [
        workspaceId,
        `transcript-${run.identity}.txt`,
        run.speech.length,
        `file-prod-studio-${set.id}-${run.key}`,
        now - (encoded.length - index) * 60_000 + 1500,
        JSON.stringify({
          transcript_snapshot: run.speech,
          text: run.speech,
          tap_session_id: runId,
          demo_marker: set.marker,
          identity: run.identity,
        }),
        owner.userId,
        owner.organizationId,
      ],
    );
  }

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
      region.name,
      set.regionDescription,
      region.embedding_model_id,
      region.dim,
      JSON.stringify(region.centroid),
      region.cohort_cohesion,
      region.mean_radius,
      region.cosine_threshold,
      region.subject_count,
      JSON.stringify(region.subjects),
      owner.userId,
    ],
  );

  return { workspaceId, flowId, publicToken, runCount: encoded.length };
}

async function main() {
  argTarget();
  const email = argEmail();
  const env = loadEnvFile(".env.local");
  const prodUrl = String(env.PROD_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");
  const prodRef = prodUrl ? projectRefFromUrl(prodUrl) : "";
  if (prodRef !== "xzwjlkngxuxttvqbboea") {
    throw new Error(
      `Expected production project xzwjlkngxuxttvqbboea, got "${prodRef || "missing"}".`,
    );
  }

  const appUrl = String(
    env.PROD_NEXT_PUBLIC_APP_URL || env.NEXT_PUBLIC_APP_URL || "https://www.uncertain.systems",
  ).replace(/\/$/, "");

  console.log(`[seed-prod-studio] marker=${PRODUCTION_STUDIO_DEMO_MARKER} sets=${PRODUCTION_STUDIO_DEMO_SETS.length}`);
  const { client, via } = await connectTarget("prod");
  console.log(`[seed-prod-studio] connected via ${via} project=${prodRef}`);

  try {
    await client.query("BEGIN");
    const owner = await resolveOwner(client, email);
    console.log(`[seed-prod-studio] owner=${owner.email}`);

    for (const set of PRODUCTION_STUDIO_DEMO_SETS) {
      const seeded = await seedSet(client, owner, set);
      const tab = set.product === "calibration" ? "calibration_studio" : "verification_studio";
      const publicPath = set.product === "calibration" ? `/c/${seeded.publicToken}` : `/v/${seeded.publicToken}`;
      console.log(
        `[seed-prod-studio] ${set.id} workspace=${seeded.workspaceId} flow=${seeded.flowId} runs=${seeded.runCount}`,
      );
      console.log(`[seed-prod-studio]   studio ${appUrl}/dashboard?tab=${tab}`);
      console.log(`[seed-prod-studio]   workspace ${appUrl}/workspace/${seeded.workspaceId}?section=data_studio`);
      console.log(`[seed-prod-studio]   public ${appUrl}${publicPath}`);
    }

    await client.query("COMMIT");
    console.log("[seed-prod-studio] SUCCESS");
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      /* ignore */
    }
    throw error;
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error("[seed-prod-studio] FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
