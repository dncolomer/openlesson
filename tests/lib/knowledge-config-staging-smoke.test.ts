/**
 * Optional staging smoke tests — run when STAGING_* env is available.
 * Skips cleanly in CI without credentials.
 *
 * Staging may still be on historical `brain_config_snapshots` until the
 * forward rename migration is applied; resolve table name at runtime.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function loadEnvLocal(): Record<string, string> {
  const path = join(ROOT, ".env.local");
  if (!existsSync(path)) return {};
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split("\n")
      .filter((line) => line && !line.startsWith("#") && line.includes("="))
      .map((line) => {
        const i = line.indexOf("=");
        return [line.slice(0, i), line.slice(i + 1)];
      }),
  );
}

const env = loadEnvLocal();
const hasStaging =
  Boolean(env.STAGING_NEXT_PUBLIC_SUPABASE_URL) &&
  Boolean(env.STAGING_SUPABASE_DB_URL || env.SUPABASE_DB_URL);

async function resolveSnapshotTable(client: {
  query: (sql: string) => Promise<{ rows: Array<{ table_name: string; rls: boolean }> }>;
}): Promise<"knowledge_config_snapshots" | "brain_config_snapshots"> {
  const tables = await client.query(`
    SELECT c.relname AS table_name, c.relrowsecurity AS rls
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relname IN ('knowledge_config_snapshots', 'brain_config_snapshots')
    ORDER BY 1
  `);
  const names = tables.rows.map((r) => r.table_name);
  if (names.includes("knowledge_config_snapshots")) return "knowledge_config_snapshots";
  if (names.includes("brain_config_snapshots")) return "brain_config_snapshots";
  throw new Error("neither knowledge_config_snapshots nor brain_config_snapshots exists");
}

describe.runIf(hasStaging)("staging knowledge-config schema smoke", () => {
  it("has tables, RLS, unique subject index, and migration recorded", async () => {
    const { connectTarget } = await import("../../scripts/db-connection.mjs");
    const { client } = await connectTarget("staging");
    try {
      const lwm = await client.query(`
        SELECT c.relname AS table_name, c.relrowsecurity AS rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = 'learning_world_models'
      `);
      expect(lwm.rows).toHaveLength(1);
      expect(lwm.rows[0].rls).toBe(true);

      const snapshotTable = await resolveSnapshotTable(client);
      const snap = await client.query(`
        SELECT c.relname AS table_name, c.relrowsecurity AS rls
        FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'public' AND c.relname = '${snapshotTable}'
      `);
      expect(snap.rows).toHaveLength(1);
      expect(snap.rows[0].rls).toBe(true);

      const mig = await client.query(`
        SELECT version FROM supabase_migrations.schema_migrations
        WHERE version IN (
          '20260719140000_learning_world_model_brain_config',
          '20260719190000_rename_brain_config_to_knowledge_config'
        )
      `);
      expect(mig.rows.length).toBeGreaterThanOrEqual(1);

      const uidx = await client.query(`
        SELECT indexname FROM pg_indexes
        WHERE schemaname = 'public'
          AND indexname = 'learning_world_models_workspace_subject_uidx'
      `);
      expect(uidx.rows).toHaveLength(1);
    } finally {
      await client.end();
    }
  }, 60_000);

  it("write/read LWM + snapshot and enforce constraints (rolled back)", async () => {
    const { connectTarget } = await import("../../scripts/db-connection.mjs");
    const {
      encodeKnowledgeConfig,
      KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    } = await import("@/lib/knowledge-config");
    const { client } = await connectTarget("staging");
    try {
      const snapshotTable = await resolveSnapshotTable(client);
      const ws = await client.query(`SELECT id FROM public.workspaces LIMIT 1`);
      expect(ws.rows[0]?.id).toBeTruthy();
      const workspaceId = ws.rows[0].id as string;

      const emb = encodeKnowledgeConfig({
        workspaceId,
        powRows: [
          { proof_of_work_type: "tool", timestamp_ms: Date.now() - 60_000, metadata: {} },
          { proof_of_work_type: "screen", timestamp_ms: Date.now(), metadata: {} },
        ],
        asOfMs: Date.now(),
      });
      expect(emb.dim).toBe(64);
      expect(emb.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);

      await client.query("BEGIN");
      try {
        const model = {
          version: 1,
          workspace_id: workspaceId,
          updated_at: new Date().toISOString(),
          inferred_goal: { text: "staging smoke", confidence: 0.5, source: "inferred" },
          exploration: { block_coverage: [], pathways_touched: [], blind_spots: [] },
          learning_profile: {
            strengths: ["smoke"],
            friction_patterns: [],
            preferred_modalities: [],
            temporal_patterns: { avg_dwell_ms: null, idle_bursts: null },
          },
          evidence_appetite: { want_more: ["reflection"], saturated: [] },
          scores_snapshot: {
            verification_score: 50,
            augmentation_score: null,
            optimization_score: null,
            ghc_score: 10,
          },
          knowledge_config: {
            embedding_model_id: emb.embedding_model_id,
            dim: emb.dim,
            vector: emb.vector,
            as_of: emb.as_of,
            pow_event_count: emb.pow_event_count,
            confidence: emb.confidence,
          },
        };

        const lwm = await client.query(
          `INSERT INTO public.learning_world_models
            (workspace_id, subject_user_id, subject_guest_user_id, model)
           VALUES ($1, NULL, NULL, $2::jsonb)
           ON CONFLICT (workspace_id, subject_user_id, subject_guest_user_id)
           DO UPDATE SET model = EXCLUDED.model, updated_at = now()
           RETURNING id`,
          [workspaceId, JSON.stringify(model)],
        );
        expect(lwm.rows[0]?.id).toBeTruthy();

        const snap = await client.query(
          `INSERT INTO public.${snapshotTable}
            (workspace_id, subject_user_id, subject_guest_user_id, embedding_model_id, dim, vector,
             as_of_ms, pow_event_count, confidence, trigger, lwm_id)
           VALUES ($1, NULL, NULL, $2, 64, $3::jsonb, $4, $5, $6, 'recompute', $7)
           RETURNING id, dim`,
          [
            workspaceId,
            KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
            JSON.stringify(emb.vector),
            emb.as_of_ms,
            emb.pow_event_count,
            emb.confidence,
            lwm.rows[0].id,
          ],
        );
        expect(snap.rows[0].dim).toBe(64);

        const loaded = await client.query(
          `SELECT model->'knowledge_config'->>'embedding_model_id' AS mid,
                  jsonb_array_length(model->'knowledge_config'->'vector') AS dim
           FROM public.learning_world_models WHERE id = $1`,
          [lwm.rows[0].id],
        );
        expect(loaded.rows[0].mid).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
        expect(Number(loaded.rows[0].dim)).toBe(64);

        await expect(
          client.query(
            `INSERT INTO public.${snapshotTable}
              (workspace_id, embedding_model_id, dim, vector, as_of_ms, confidence, trigger)
             VALUES ($1, $2, 0, '[]'::jsonb, 1, 0.5, 'score')`,
            [workspaceId, KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID],
          ),
        ).rejects.toThrow();

        await expect(
          client.query(
            `INSERT INTO public.${snapshotTable}
              (workspace_id, embedding_model_id, dim, vector, as_of_ms, confidence, trigger)
             VALUES ($1, $2, 64, $3::jsonb, 2, 1.5, 'score')`,
            [workspaceId, KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID, JSON.stringify(emb.vector)],
          ),
        ).rejects.toThrow();
      } finally {
        await client.query("ROLLBACK");
      }
    } finally {
      await client.end();
    }
  }, 60_000);
});

describe.runIf(!hasStaging)("staging knowledge-config schema smoke (skipped)", () => {
  it("skips when staging env is not configured", () => {
    expect(hasStaging).toBe(false);
  });
});
