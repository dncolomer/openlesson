import { afterEach, describe, expect, it, vi } from "vitest";
import { embedFlowOutput, FLOW_EMBEDDING_DIM, FLOW_EMBEDDING_MODEL_ID } from "@/lib/flow-embedding";
import { persistCompletedFlowEmbedding, resetFlowEmbeddingStore } from "@/lib/flow-embedding-store";
import { requestFlowcfgEmbeddings } from "@/lib/flowcfg-embeddings-api";

const FIXTURE_RAW = {
  flowKind: "verify" as const,
  genModel: {
    chapterTitle: "Quadratic",
    rootId: "root",
    branches: [
      {
        id: "root",
        parentId: null,
        title: "Quadratic",
        question: "What is Quadratic?",
        territory: "quadratic",
        observation: "Quadratic is open.",
        depth: 0,
        status: "open",
        edges: [
          { toId: "cheap", price: 8 },
          { toId: "costly", price: 90 },
        ],
      },
      {
        id: "cheap",
        parentId: "root",
        title: "Complete the square",
        question: "What is Complete the square?",
        territory: "complete the square",
        observation: "Complete the square is open.",
        depth: 1,
        status: "open",
        edges: [{ toId: "cheap-leaf", price: 12 }],
      },
      {
        id: "cheap-leaf",
        parentId: "cheap",
        title: "Vertex form",
        question: "What is Vertex form?",
        territory: "vertex form",
        observation: "Vertex form is open.",
        depth: 2,
        status: "open",
        edges: [],
      },
      {
        id: "costly",
        parentId: "root",
        title: "Expand every term",
        question: "What is Expand every term?",
        territory: "expand every term",
        observation: "Expand every term is open.",
        depth: 1,
        status: "open",
        edges: [{ toId: "costly-leaf", price: 85 }],
      },
      {
        id: "costly-leaf",
        parentId: "costly",
        title: "Guess the roots",
        question: "What is Guess the roots?",
        territory: "guess the roots",
        observation: "Guess the roots is open.",
        depth: 2,
        status: "open",
        edges: [],
      },
    ],
  },
  projectedPolicy: {
    sequence: ["root", "cheap", "cheap-leaf"],
    steps: 3,
    excess: 0,
    distance: 20,
  },
  pow: [
    {
      type: "tool",
      tool_name: "speech-segment",
      tool_action: "speech_stop",
      timestamp_ms: 1,
      payload: "I complete the square.",
      metadata: { transcript_snapshot: "I complete the square." },
    },
  ],
};

describe("flowcfg embeddings persist client", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    resetFlowEmbeddingStore("memory");
  });

  it("persistCompletedFlowEmbedding POSTs /v1/embed with Path raw and stores returned Path", async () => {
    const local = embedFlowOutput(FIXTURE_RAW);
    const fetchSpy = vi.spyOn(globalThis, "fetch");
    resetFlowEmbeddingStore("memory");
    const stored = await persistCompletedFlowEmbedding({
      ownerUserId: "owner-embed",
      flowKind: "verify",
      flowId: "vf-embed",
      raw: FIXTURE_RAW,
    });
    expect(fetchSpy).toHaveBeenCalled();
    const call = fetchSpy.mock.calls.find(([input]) => String(input).includes("/v1/embed"));
    expect(call).toBeTruthy();
    expect(String(call![0])).toBe("http://flowcfg-embeddings.test/v1/embed");
    const init = call![1] as RequestInit;
    expect(init.method).toBe("POST");
    expect(String(init.headers && (init.headers as Record<string, string>).Authorization)).toContain(
      "Bearer ",
    );
    const body = JSON.parse(String(init.body)) as {
      model: string;
      raw: { genModel?: unknown; projectedPolicy?: unknown; pow?: unknown; flowKind?: unknown };
    };
    expect(body.model).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(body.raw.flowKind).toBeUndefined();
    expect(body.raw.genModel).toMatchObject({ rootId: "root" });
    expect(body.raw.projectedPolicy).toMatchObject({ sequence: ["root", "cheap", "cheap-leaf"] });
    expect(Array.isArray(body.raw.pow)).toBe(true);
    expect(stored.vector).toHaveLength(FLOW_EMBEDDING_DIM);
    expect(stored.vector).toEqual(local.vector);
    expect(stored.channel_vectors.path).toEqual(local.channel_vectors.path);
    expect(stored.raw.projectedPolicy?.sequence).toEqual(["root", "cheap", "cheap-leaf"]);
  });

  it("requestFlowcfgEmbeddings returns the service Path numbers", async () => {
    const local = embedFlowOutput(FIXTURE_RAW);
    const result = await requestFlowcfgEmbeddings(FIXTURE_RAW);
    expect(result.model).toBe(FLOW_EMBEDDING_MODEL_ID);
    expect(result.embedding).toEqual(local.vector);
  });
});
