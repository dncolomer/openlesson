import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { encodeFlowEmbedding } from "@/lib/flow-embedding-encode";
import type { StoredFlowEmbedding } from "@/lib/flow-embedding-store";
import {
  presentKnowledgeRegionUncertaintyModel,
  presentUnsysWalkOverlay,
} from "@/lib/knowledge-region-unsys";
import type { SessionBranchModel } from "@/lib/session-branch-model";

const ROOT = join(__dirname, "../..");

function branch(
  id: string,
  parentId: string | null,
  title: string,
  edges: Array<{ toId: string; price: number }>,
): SessionBranchModel["branches"][number] {
  return {
    id,
    parentId,
    title,
    question: `What is ${title}?`,
    territory: title,
    observation: `${title} is open.`,
    depth: parentId ? 1 : 0,
    status: "open",
    edges,
  };
}

function tree(): SessionBranchModel {
  return {
    chapterTitle: "Limits",
    rootId: "root",
    focusId: "root",
    step: 0,
    boardNotes: [],
    branches: [
      branch("root", null, "Limits", [
        { toId: "visited-a", price: 10 },
        { toId: "skipped", price: 40 },
        { toId: "visited-b", price: 20 },
      ]),
      branch("visited-a", "root", "Delta", [{ toId: "visited-b", price: 15 }]),
      branch("skipped", "root", "Off path", []),
      branch("visited-b", "root", "Epsilon", []),
    ],
  };
}

describe("presentUnsysWalkOverlay", () => {
  it("marks every hidden state and stamps 1-based walk order", async () => {
    const overlay = presentUnsysWalkOverlay({
      reference: tree(),
      walk: ["root", "visited-a", "visited-b"],
    });
    expect(overlay.hidden_states.map((row) => row.id).sort()).toEqual(
      ["root", "skipped", "visited-a", "visited-b"].sort(),
    );
    const byId = Object.fromEntries(overlay.hidden_states.map((row) => [row.id, row]));
    expect(byId.root).toMatchObject({ visited: true, sequence: 1 });
    expect(byId["visited-a"]).toMatchObject({ visited: true, sequence: 2 });
    expect(byId["visited-b"]).toMatchObject({ visited: true, sequence: 3 });
    expect(byId.skipped).toMatchObject({ visited: false, sequence: null });
    expect(byId.skipped.edges).toEqual([]);
    expect(byId.root.edges).toEqual(
      expect.arrayContaining([
        { to_id: "visited-a", price: 10 },
        { to_id: "skipped", price: 40 },
      ]),
    );
    expect(overlay.walk).toEqual(["root", "visited-a", "visited-b"]);
  });

  it("keeps the full tree when the walk is empty", async () => {
    const overlay = presentUnsysWalkOverlay({
      reference: tree(),
      walk: [],
    });
    expect(overlay.hidden_states).toHaveLength(4);
    expect(overlay.hidden_states.every((row) => row.visited === false && row.sequence == null)).toBe(
      true,
    );
  });
});

describe("presentKnowledgeRegionUncertaintyModel", () => {
  const parent = {
    id: "parent",
    name: "Limits styles",
    description: null,
    product: "verification",
    owner_user_id: "me",
    workspace_id: "ws-1",
    verify_flow_id: "flow-a",
    cosine_threshold: 0.1,
    subjects: [{ label: "ada", user_id: "user_ada" }],
  };

  function stored(sequence: string[]): StoredFlowEmbedding {
    const model = tree();
    const record = await encodeFlowEmbedding({
      flowKind: "verify",
      model,
      sequence,
      pow: [{ type: "tool", tool_name: "canvas", timestamp_ms: 1, payload: "draw" }],
    });
    return {
      id: "obs-1",
      workspace_id: "ws-1",
      owner_user_id: "me",
      flow_kind: "verify",
      flow_id: "flow-a",
      run_id: "run-ada",
      identity: "ada",
      source: "runner",
      embedding_model_id: record.embedding_model_id,
      dim: record.dim,
      vector: record.vector,
      vector_path_text: record.vector_path_text,
      channel_vectors: record.channel_vectors,
      raw: record.raw,
      created_at: "2026-03-01T12:00:00.000Z",
    };
  }

  it("returns the reference tree and the mapped walk for a known run", async () => {
    const embedding = stored(["root", "visited-a"]);
    const payload = presentKnowledgeRegionUncertaintyModel({
      knowledgeRegionId: "parent",
      candidateId: "ada",
      runId: "run-ada",
      parent,
      embeddings: [embedding],
      referenceModel: tree(),
    });
    expect(payload.reference.hidden_states.map((row) => row.id).sort()).toEqual(
      ["root", "skipped", "visited-a", "visited-b"].sort(),
    );
    expect(payload.mapped.sequence).toEqual(["root", "visited-a"]);
    expect(payload.overlay.hidden_states.find((row) => row.id === "skipped")?.visited).toBe(false);
    expect(payload.overlay.hidden_states.find((row) => row.id === "visited-a")?.sequence).toBe(2);
    expect(payload.run_id).toBe("run-ada");
    expect(payload).not.toHaveProperty("vector");
    expect(payload.mapped).not.toHaveProperty("pow");
  });

  it("returns an empty mapped walk for an unknown candidate without throwing", async () => {
    const payload = presentKnowledgeRegionUncertaintyModel({
      knowledgeRegionId: "parent",
      candidateId: "nobody",
      parent,
      embeddings: [stored(["root"])],
      referenceModel: tree(),
    });
    expect(payload.mapped.sequence).toEqual([]);
    expect(payload.observation_id).toBeNull();
    expect(payload.reference.hidden_states.length).toBe(4);
    expect(payload.overlay.hidden_states.every((row) => row.sequence == null)).toBe(true);
  });

  it("ships the v3 and dashboard routes", async () => {
    const v3 = join(
      ROOT,
      "app/api/v3/knowledge-regions/[id]/candidates/[candidateId]/uncertainty-model/route.ts",
    );
    const dashboard = join(
      ROOT,
      "app/api/dashboard/knowledge-regions/[id]/uncertainty-model/route.ts",
    );
    expect(existsSync(v3)).toBe(true);
    expect(existsSync(dashboard)).toBe(true);
    expect(readFileSync(v3, "utf8")).toContain("loadKnowledgeRegionUncertaintyModel");
    expect(readFileSync(dashboard, "utf8")).toContain("loadKnowledgeRegionUncertaintyModel");
  });
});
