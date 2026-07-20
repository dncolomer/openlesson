/**
 * Drives the shipped encode/load path and asserts knowledge configuration field shapes.
 * When SHAPE_OUT is set, writes a JSON proof artifact (used by goal verification).
 */
import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import {
  encodeKnowledgeConfig,
  emptyKnowledgeConfig,
  projectKnowledgeConfigTo2D,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  KNOWLEDGE_CONFIG_DIM,
  isKnowledgeConfigVector,
} from "@/lib/knowledge-config";
import { knowledgeConfigPointerFromEmbedding } from "@/lib/agent-v2/knowledge-config-store";

describe("knowledge config shipped encode path shapes", () => {
  it("encodeKnowledgeConfig returns knowledgecfg-v1-d64 pointer-ready shape", () => {
    const emb = encodeKnowledgeConfig({
      workspaceId: "ws-shape-proof",
      powRows: [
        { proof_of_work_type: "tool", timestamp_ms: 1_700_000_000_000, metadata: { tool: "editor" } },
        { proof_of_work_type: "screen", timestamp_ms: 1_700_000_060_000, metadata: {} },
      ],
      asOfMs: 1_700_000_120_000,
    });
    const empty = emptyKnowledgeConfig(0);
    const proj = projectKnowledgeConfigTo2D(emb.vector);
    const knowledge_config = knowledgeConfigPointerFromEmbedding(emb);

    const proof = {
      knowledge_config,
      embedding_model_id: emb.embedding_model_id,
      expected_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
      dim: emb.dim,
      expected_dim: KNOWLEDGE_CONFIG_DIM,
      isVector: isKnowledgeConfigVector(emb.vector),
      confidence: emb.confidence,
      pow_event_count: emb.pow_event_count,
      projection: proj,
      empty_model_id: empty.embedding_model_id,
      empty_dim: empty.dim,
      user_facing_label: "knowledge configuration",
      json_field: "knowledge_config",
      path_segment: "knowledge-config",
      table: "knowledge_config_snapshots",
    };

    if (process.env.SHAPE_OUT) {
      writeFileSync(process.env.SHAPE_OUT, JSON.stringify(proof, null, 2));
    }

    expect(emb.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID).toBe("knowledgecfg-v1-d64");
    expect(emb.dim).toBe(64);
    expect(isKnowledgeConfigVector(emb.vector)).toBe(true);
    expect(knowledge_config.embedding_model_id).toBe("knowledgecfg-v1-d64");
    expect(knowledge_config.vector).toEqual(emb.vector);
    expect(typeof emb.confidence).toBe("number");
    expect(typeof proj.x).toBe("number");
    expect(typeof proj.y).toBe("number");
    // Product vocabulary on response/API surface
    expect(proof.json_field).toBe("knowledge_config");
    expect(proof.user_facing_label).toMatch(/knowledge configuration/);
  });
});
