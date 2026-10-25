/**
 * Seed a Verification flow + Path-space region + spoken traces onto the
 * database localhost uses (staging Supabase). Refuses production.
 *
 * Usage:
 *   npm run db:seed-localhost-verification-studio
 *   npm run db:seed-localhost-verification-studio -- --email=you@example.com
 */

import { randomUUID } from "node:crypto";
import { connectTarget, loadEnvFile, projectRefFromUrl } from "./db-connection.mjs";
import {
  LOCALHOST_VERIFICATION_STUDIO_FLOW,
  LOCALHOST_VERIFICATION_STUDIO_MARKER,
  LOCALHOST_VERIFICATION_STUDIO_WORKSPACE,
  buildLocalhostVerificationStudioRegions,
  encodeLocalhostVerificationStudioRuns,
  localhostVerificationStudioTree,
} from "../lib/demo/localhost-verification-studio-sample";
import { FLOW_EMBEDDING_DIM, FLOW_EMBEDDING_MODEL_ID } from "../lib/flow-embedding";

type PgClient = {
  query: (sql: string, params?: unknown[]) => Promise<{ rows: Array<Record<string, unknown>> }>;
};

function argEmail(argv: string[] = process.argv): string {
  const raw = argv.find((arg) => arg.startsWith("--email="))?.slice("--email=".length);
  return String(raw || "").trim().toLowerCase();
}

function argTarget(argv: string[] = process.argv): "staging" {
  const raw = argv.find((arg) => arg.startsWith("--target="))?.slice("--target=".length);
  if (!raw || raw === "staging" || raw === "localhost" || raw === "local") return "staging";
  throw new Error(
    `Refusing target "${raw}". This seed is localhost/staging only.`,
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
    throw new Error("No profile with organization_id found to own the sample workspace");
  }
  return {
    userId: String(preferred.rows[0].user_id),
    organizationId: String(preferred.rows[0].organization_id),
    email: String(preferred.rows[0].email),
  };
}

async function main() {
  argTarget();
  const email = argEmail();
  const env = loadEnvFile(".env.local");
  const appUrl = String(env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const stagingUrl = String(env.STAGING_NEXT_PUBLIC_SUPABASE_URL || env.NEXT_PUBLIC_SUPABASE_URL || "");
  const stagingRef = stagingUrl ? projectRefFromUrl(stagingUrl) : "";
  if (!stagingRef || stagingRef === "xzwjlkngxuxttvqbboea") {
    throw new Error("Refusing production project. This seed is localhost/staging only.");
  }

  console.log(`[seed-local-studio] marker=${LOCALHOST_VERIFICATION_STUDIO_MARKER}`);
  const { client, via } = await connectTarget("staging");
  console.log(`[seed-local-studio] connected via ${via} project=${stagingRef}`);

  try {
    await client.query("BEGIN");
    const owner = await resolveOwner(client, email);
    console.log(`[seed-local-studio] owner=${owner.email}`);

    const existing = await client.query(
      `SELECT id FROM public.workspaces WHERE notes ILIKE $1 ORDER BY created_at DESC LIMIT 1`,
      [`%${LOCALHOST_VERIFICATION_STUDIO_MARKER}%`],
    );
    const existingId = existing.rows[0]?.id ? String(existing.rows[0].id) : null;
    if (existingId) {
      console.log(`[seed-local-studio] replacing workspace ${existingId}`);
      await client.query(`DELETE FROM public.knowledge_regions WHERE workspace_id = $1`, [
        existingId,
      ]);
      await client.query(`DELETE FROM public.session_embeddings WHERE workspace_id = $1`, [
        existingId,
      ]);
      await client.query(`DELETE FROM public.proof_of_work WHERE workspace_id = $1`, [
        existingId,
      ]);
      await client.query(`DELETE FROM public.workspaces WHERE id = $1`, [existingId]);
    }

    const workspaceId = randomUUID();
    await client.query(
      `INSERT INTO public.workspaces (
         id, user_id, author_id, title, root_topic, status,
         description, notes,
         organization_id, is_public, is_agent_workspace, workspace_kind
       ) VALUES (
         $1, $2, $2, $3, $4, $5,
         $6, $7,
         $8, false, false, 'standard'
       )`,
      [
        workspaceId,
        owner.userId,
        LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.title,
        LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.root_topic,
        LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.status,
        LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.description,
        LOCALHOST_VERIFICATION_STUDIO_WORKSPACE.notes,
        owner.organizationId,
      ],
    );

    const flowId = randomUUID();
    const publicToken = `${LOCALHOST_VERIFICATION_STUDIO_FLOW.publicTokenPrefix}-${flowId.slice(0, 8)}`;
    await client.query(
      `INSERT INTO public.verify_flows (
         id, name, topic, questions, duration_minutes, action_catalog, public_token, owner_user_id
       ) VALUES ($1, $2, $3, $4::jsonb, $5, $6, $7, $8)`,
      [
        flowId,
        LOCALHOST_VERIFICATION_STUDIO_FLOW.name,
        LOCALHOST_VERIFICATION_STUDIO_FLOW.topic,
        JSON.stringify(LOCALHOST_VERIFICATION_STUDIO_FLOW.questions),
        LOCALHOST_VERIFICATION_STUDIO_FLOW.durationMinutes,
        LOCALHOST_VERIFICATION_STUDIO_FLOW.actionCatalog,
        publicToken,
        owner.userId,
      ],
    );

    const model = localhostVerificationStudioTree();
    const encoded = encodeLocalhostVerificationStudioRuns(model);
    const regions = buildLocalhostVerificationStudioRegions(encoded);
    const now = Date.now();

    for (const [index, run] of encoded.entries()) {
      const runId = randomUUID();
      const createdAt = new Date(now - (encoded.length - index) * 60_000).toISOString();
      await client.query(
        `INSERT INTO public.sessions (
           id, user_id, problem, status, kind, verify_flow_id, identity, workspace_id, result, created_at
         ) VALUES (
           $1, $2, 'Verify', 'completed', 'verify', $3, $4, $5,
           $6::jsonb, $7
         )`,
        [
          runId,
          owner.userId,
          flowId,
          run.identity,
          workspaceId,
          JSON.stringify({
            kind: "verify",
            projectedPolicy: null,
            knowledgeRegionId: null,
            answers: [
              {
                id: runId,
                identity: run.identity,
                source: "runner",
                questionId: LOCALHOST_VERIFICATION_STUDIO_FLOW.questions[0]?.id ?? null,
                prompt: run.speech,
                createdAt,
              },
            ],
          }),
          createdAt,
        ],
      );
      await client.query(
        `INSERT INTO public.session_embeddings (
           id, workspace_id, flow_kind, flow_id, run_id, identity, source,
           embedding_model_id, dim, vector, raw, created_at, session_id, owner_user_id
         ) VALUES (
           $1, $2, 'verify', $3, $4, $5, 'runner',
           $6, $7, $8::jsonb, $9::jsonb, $10, $4::uuid, $11
         )`,
        [
          randomUUID(),
          workspaceId,
          flowId,
          runId,
          run.identity,
          FLOW_EMBEDDING_MODEL_ID,
          FLOW_EMBEDDING_DIM,
          JSON.stringify(run.embedding.vector),
          JSON.stringify(run.embedding.raw),
          createdAt,
          owner.userId,
        ],
      );
      await client.query(
        `INSERT INTO public.proof_of_work (
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
          `file-local-studio-${run.key}`,
          now - (encoded.length - index) * 60_000 + 1500,
          JSON.stringify({
            transcript_snapshot: run.speech,
            text: run.speech,
            tap_session_id: runId,
            demo_marker: LOCALHOST_VERIFICATION_STUDIO_MARKER,
            identity: run.identity,
          }),
          owner.userId,
          owner.organizationId,
        ],
      );
    }

    for (const region of [regions.path, regions.voice]) {
      await client.query(
        `INSERT INTO public.knowledge_regions (
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
          region.embedding_model_id === FLOW_EMBEDDING_MODEL_ID
            ? "Path-space region of the cheapest ε-δ walks (ada, bea, cam)."
            : "Path + Text region of the cheapest ε-δ walks (ada, bea, cam).",
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
    }

    await client.query("COMMIT");
    console.log(`[seed-local-studio] workspace_id=${workspaceId}`);
    console.log(`[seed-local-studio] flow_id=${flowId} token=${publicToken}`);
    console.log(
      `[seed-local-studio] runs=${encoded.length} regions=${regions.path.name}, ${regions.voice.name}`,
    );
    console.log(`[seed-local-studio] Data Studio ${appUrl}/dashboard?tab=verification_studio`);
    console.log(`[seed-local-studio] Workspace ${appUrl}/workspace/${workspaceId}?section=data_studio`);
    console.log(`[seed-local-studio] Public flow ${appUrl}/v/${publicToken}`);
    console.log(
      "[seed-local-studio] Path: ada=bea (same walk), cam nearby in-region, eve outside. Path + Text splits ada/bea speech.",
    );
    console.log("[seed-local-studio] SUCCESS");
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
  console.error("[seed-local-studio] FAILED:", error instanceof Error ? error.message : error);
  process.exit(1);
});
