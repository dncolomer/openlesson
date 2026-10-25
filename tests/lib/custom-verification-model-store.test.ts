import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createCustomVerificationModelFromVectors } from "@/lib/knowledge-config";
import {
  embedTextsToFlowVector,
  FLOW_EMBEDDING_MODEL_ID,
} from "@/lib/flow-embedding";
import {
  computeKnowledgeDistanceForSubject,
  createCustomVerificationModelFromSubjects,
  evalSubjectAgainstCustomVerificationModel,
  listSubjectsWithKnowledgeConfig,
} from "@/lib/pow-api/custom-verification-model-store";
import { subjectIdentityKey } from "@/lib/pow-api/subject-ref";

type FilterCall = { table: string; method: string; args: unknown[] };

function flowVector(seed: string): number[] {
  return embedTextsToFlowVector([seed, "flowcfg", "knowledge-region"]);
}

function modelRow(
  id: string,
  spec: ReturnType<typeof createCustomVerificationModelFromVectors>,
  workspaceId = "ws-1",
) {
  return {
    id,
    workspace_id: workspaceId,
    name: spec.name,
    description: null,
    embedding_model_id: spec.embedding_model_id,
    dim: spec.dim,
    centroid: spec.centroid,
    cohort_cohesion: spec.cohort_cohesion,
    mean_radius: spec.mean_radius,
    cosine_threshold: spec.cosine_threshold,
    subject_count: spec.subject_count,
    subjects: spec.subjects,
    created_by: "owner",
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  };
}

function makeStoreClient(opts: {
  embeddings?: Array<Record<string, unknown>>;
  models?: Array<Record<string, unknown>>;
  pow?: Array<Record<string, unknown>>;
  workspaces?: Array<Record<string, unknown>>;
}) {
  const calls: FilterCall[] = [];
  const embeddings = (opts.embeddings ?? []).slice();
  const models = (opts.models ?? []).slice();
  const pow = opts.pow ?? [];
  const workspaces = (opts.workspaces ?? []).slice();
  const inserts: Record<string, unknown>[] = [];

  const client = {
    from(table: string) {
      const filters: Array<{ method: string; args: unknown[] }> = [];
      let lastInserted: Record<string, unknown> | null = null;
      const record = (method: string, args: unknown[]) => {
        filters.push({ method, args });
        calls.push({ table, method, args });
      };

      const applyEq = (
        rows: Array<Record<string, unknown>>,
        column: unknown,
        value: unknown,
      ) => rows.filter((row) => row[String(column)] === value);

      const resolveList = () => {
        if (table === "workspace_flow_embeddings") {
          let rows = embeddings.slice();
          for (const f of filters) {
            if (f.method === "eq") rows = applyEq(rows, f.args[0], f.args[1]);
            if (f.method === "order") {
              const column = String(f.args[0]);
              const ascending =
                (f.args[1] as { ascending?: boolean } | undefined)?.ascending !== false;
              rows = rows.slice().sort((a, b) => {
                const av = String(a[column] ?? "");
                const bv = String(b[column] ?? "");
                return ascending ? av.localeCompare(bv) : bv.localeCompare(av);
              });
            }
            if (f.method === "limit") rows = rows.slice(0, Number(f.args[0]));
          }
          return { data: rows, error: null };
        }
        if (table === "workspace_proof_of_work") {
          return { data: pow, error: null };
        }
        if (
          table === "workspace_calibrate_sessions" ||
          table === "workspace_verify_sessions" ||
          table === "workspace_learn_links"
        ) {
          return { data: [], error: null };
        }
        if (table === "custom_verification_models") {
          if (lastInserted) return { data: [lastInserted], error: null };
          let rows = models.slice();
          for (const f of filters) {
            if (f.method === "eq") rows = applyEq(rows, f.args[0], f.args[1]);
          }
          return { data: rows, error: null };
        }
        if (table === "workspaces") {
          let rows = workspaces.slice();
          for (const f of filters) {
            if (f.method === "eq") rows = applyEq(rows, f.args[0], f.args[1]);
          }
          return { data: rows, error: null };
        }
        return { data: [], error: null };
      };

      const chain: {
        select: (...args: unknown[]) => typeof chain;
        eq: (...args: unknown[]) => typeof chain;
        order: (...args: unknown[]) => typeof chain;
        limit: (...args: unknown[]) => typeof chain;
        insert: (payload: Record<string, unknown>) => typeof chain;
        maybeSingle: () => Promise<{ data: Record<string, unknown> | null; error: null }>;
        then: (
          resolve: (value: { data: Array<Record<string, unknown>>; error: null }) => unknown,
          reject?: (reason: unknown) => unknown,
        ) => Promise<unknown>;
      } = {
        select: (...args: unknown[]) => {
          record("select", args);
          return chain;
        },
        eq: (...args: unknown[]) => {
          record("eq", args);
          return chain;
        },
        order: (...args: unknown[]) => {
          record("order", args);
          return chain;
        },
        limit: (...args: unknown[]) => {
          record("limit", args);
          return chain;
        },
        insert: (payload: Record<string, unknown>) => {
          record("insert", [payload]);
          lastInserted = {
            id: `inserted-${inserts.length + 1}`,
            created_at: "2026-01-02T00:00:00.000Z",
            ...payload,
          };
          inserts.push(lastInserted);
          models.push(lastInserted);
          return chain;
        },
        maybeSingle: async () => {
          const { data, error } = resolveList();
          return { data: data[0] ?? null, error };
        },
        then: (resolve, reject) => Promise.resolve(resolveList()).then(resolve, reject),
      };
      return chain;
    },
  };

  return { client: client as unknown as SupabaseClient, calls, inserts };
}

function embeddingEqIdentityCalls(calls: FilterCall[]) {
  return calls.filter(
    (call) =>
      call.table === "workspace_flow_embeddings" &&
      call.method === "eq" &&
      call.args[0] === "identity",
  );
}

function embeddingLimitCalls(calls: FilterCall[]) {
  return calls.filter(
    (call) => call.table === "workspace_flow_embeddings" && call.method === "limit",
  );
}

function embeddingOrderCalls(calls: FilterCall[]) {
  return calls.filter(
    (call) => call.table === "workspace_flow_embeddings" && call.method === "order",
  );
}

function expectLatestIdentityQuery(calls: FilterCall[], identity: string) {
  expect(embeddingEqIdentityCalls(calls).map((c) => c.args[1])).toEqual([identity]);
  expect(embeddingOrderCalls(calls).map((c) => c.args)).toEqual([
    ["created_at", { ascending: false }],
  ]);
  expect(embeddingLimitCalls(calls).map((c) => c.args[0])).toEqual([1]);
}

describe("custom verification model store (identity queries)", () => {
  it("evalSubjectAgainstCustomVerificationModel filters embeddings by subject identity", async () => {
    const vector = flowVector("expert");
    const spec = createCustomVerificationModelFromVectors({
      name: "SRE bar",
      vectors: [vector],
      subjects: [{ user_id: "user-1" }],
    });
    const { client, calls } = makeStoreClient({
      models: [modelRow("region-1", spec)],
      embeddings: [
        {
          workspace_id: "ws-1",
          identity: "user-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector,
          created_at: "2026-03-01T00:00:00.000Z",
        },
        {
          workspace_id: "ws-1",
          identity: "other",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector: flowVector("other"),
          created_at: "2026-04-01T00:00:00.000Z",
        },
      ],
    });

    const subject = { user_id: "user-1", guest_user_id: null };
    const result = await evalSubjectAgainstCustomVerificationModel(client, {
      workspaceId: "ws-1",
      modelId: "region-1",
      subject,
    });

    expect(result.model.id).toBe("region-1");
    expect(result.score.model_name).toBe("SRE bar");
    expectLatestIdentityQuery(calls, subjectIdentityKey(subject) as string);
  });

  it("eval uses guest identity key, not a signed-in user_id", async () => {
    const vector = flowVector("guest-run");
    const spec = createCustomVerificationModelFromVectors({
      name: "Guest bar",
      vectors: [vector],
      subjects: [{ guest_user_id: "guest-1" }],
    });
    const { client, calls } = makeStoreClient({
      models: [modelRow("region-g", spec)],
      embeddings: [
        {
          workspace_id: "ws-1",
          identity: "guest-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    const subject = { user_id: null, guest_user_id: "guest-1" };
    await evalSubjectAgainstCustomVerificationModel(client, {
      workspaceId: "ws-1",
      modelId: "region-g",
      subject,
    });

    expect(subjectIdentityKey(subject)).toBe("guest-1");
    expectLatestIdentityQuery(calls, "guest-1");
  });

  it("createCustomVerificationModelFromSubjects loads each subject by identity", async () => {
    const vector = flowVector("cohort");
    const { client, calls, inserts } = makeStoreClient({
      embeddings: [
        {
          workspace_id: "ws-1",
          identity: "user-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    const created = await createCustomVerificationModelFromSubjects(client, {
      workspaceId: "ws-1",
      name: "Cohort",
      subjects: [{ user_id: "user-1" }],
      ownerUserId: "workspace-owner",
      createdBy: "aycl:purchase-1",
    });

    expect(created.model.name).toBe("Cohort");
    expect(inserts.length).toBeGreaterThanOrEqual(1);
    expect(inserts[0]?.owner_user_id).toBe("workspace-owner");
    expect(inserts[0]?.created_by).toBe("aycl:purchase-1");
    expectLatestIdentityQuery(calls, "user-1");
  });

  it("looks up workspaces.user_id when ownerUserId is missing", async () => {
    const vector = flowVector("cohort");
    const { client, inserts } = makeStoreClient({
      embeddings: [
        {
          workspace_id: "ws-1",
          identity: "user-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
      workspaces: [{ id: "ws-1", user_id: "workspace-owner" }],
    });

    await createCustomVerificationModelFromSubjects(client, {
      workspaceId: "ws-1",
      name: "Cohort",
      subjects: [{ user_id: "user-1" }],
      createdBy: "aycl:purchase-1",
    });

    expect(inserts[0]?.owner_user_id).toBe("workspace-owner");
    expect(inserts[0]?.created_by).toBe("aycl:purchase-1");
  });

  it("computeKnowledgeDistanceForSubject uses the newest embedding for an identity", async () => {
    const older = flowVector("older-run");
    const newer = flowVector("newer-run");
    const spec = createCustomVerificationModelFromVectors({
      name: "Distance bar",
      vectors: [newer],
    });
    const { client, calls } = makeStoreClient({
      models: [modelRow("region-d", spec)],
      embeddings: [
        {
          workspace_id: "ws-1",
          identity: "user-9",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector: older,
          created_at: "2026-01-01T00:00:00.000Z",
        },
        {
          workspace_id: "ws-1",
          identity: "user-9",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          vector: newer,
          created_at: "2026-03-01T00:00:00.000Z",
        },
      ],
    });

    const result = await computeKnowledgeDistanceForSubject(client, {
      workspaceId: "ws-1",
      regionId: "region-d",
      subject: { user_id: "user-9" },
    });
    expect(result.knowledge_distance.region_name).toBe("Distance bar");
    expect(result.subject.user_id).toBe("user-9");
    expect(result.subject.as_of_ms).toBe(Date.parse("2026-03-01T00:00:00.000Z"));
    expect(result.knowledge_distance.knowledge_distance).toBeLessThan(1e-6);
    expectLatestIdentityQuery(calls, "user-9");
  });

  it("listSubjectsWithKnowledgeConfig emits user_id vs guest_user_id from PoW provenance", async () => {
    const { client } = makeStoreClient({
      embeddings: [
        {
          workspace_id: "ws-1",
          identity: "user-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          created_at: "2026-03-02T00:00:00.000Z",
        },
        {
          workspace_id: "ws-1",
          identity: "guest-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          created_at: "2026-03-01T00:00:00.000Z",
        },
        {
          workspace_id: "ws-1",
          identity: "unknown-1",
          embedding_model_id: FLOW_EMBEDDING_MODEL_ID,
          created_at: "2026-02-01T00:00:00.000Z",
        },
      ],
      pow: [
        { user_id: "user-1", guest_user_id: null, metadata: {} },
        { user_id: null, guest_user_id: "guest-1", metadata: {} },
      ],
    });

    const subjects = await listSubjectsWithKnowledgeConfig(client, "ws-1");
    expect(subjects).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ user_id: "user-1", guest_user_id: null }),
        expect.objectContaining({ user_id: null, guest_user_id: "guest-1" }),
        expect.objectContaining({ user_id: null, guest_user_id: "unknown-1" }),
      ]),
    );
    expect(subjects.find((s) => s.user_id === "user-1")?.guest_user_id).toBeNull();
    expect(subjects.find((s) => s.guest_user_id === "guest-1")?.user_id).toBeNull();
  });
});
