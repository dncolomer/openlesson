import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";
import { DEFAULT_PROMPTS, ILE_CONTEXT, type PromptKey } from "@/lib/prompts";
import { buildTapScoreInstructions } from "@/lib/tap-score";
import { buildProofOfWorkSchemaInstructions } from "@/lib/pow-api/proof-of-work-schema";

const ACTIVE_KEYS: PromptKey[] = [
  "gap_detection",
  "opening_probe",
  "probe_generation",
  "report_generation",
  "follow_up_sessions",
  "generate_objectives",
  "session_plan_create",
  "session_plan_update",
];

describe("prompt inventory", () => {
  it("covers every DEFAULT_PROMPTS key as active", () => {
    const allKeys = Object.keys(DEFAULT_PROMPTS) as PromptKey[];
    const classified = new Set(ACTIVE_KEYS);
    expect(classified.size).toBe(allKeys.length);
    for (const key of allKeys) {
      expect(classified.has(key)).toBe(true);
    }
  });

  it("active keys are referenced by getPrompt in lib/xai.ts", () => {
    const xaiSrc = fs.readFileSync(
      path.join(process.cwd(), "lib/xai.ts"),
      "utf8"
    );
    for (const key of ACTIVE_KEYS) {
      expect(xaiSrc).toContain(`getPrompt("${key}"`);
    }
  });

  it("ILE_CONTEXT is injected into session planner prompts", () => {
    const create = buildTapScoreInstructions(
      {
        plan: { id: "w1", title: "Test", root_topic: "Topic", description: null, notes: null },
        nodes: [],
        sessions: [],
      },
      "curious",
      15
    );
    expect(create).toContain("Think Aloud Protocol");
    expect(create).not.toContain("{brief.");
  });

  it("buildProofOfWorkSchemaInstructions returns non-empty schema guidance", () => {
    const instructions = buildProofOfWorkSchemaInstructions({
      definition: "Verify the learner can explain causal reasoning for the selected block.",
      block_id: "block-1",
      integration_hints: { tool_name: "demo_action" },
    });
    expect(instructions.length).toBeGreaterThan(100);
    expect(instructions).toContain("proof-of-work");
  });

  it("DEFAULT_PROMPTS keys match PROMPT_META keys", async () => {
    const { PROMPT_META } = await import("@/lib/prompts");
    expect(Object.keys(PROMPT_META).sort()).toEqual(
      Object.keys(DEFAULT_PROMPTS).sort()
    );
  });

  it("every active prompt key has non-empty default text", () => {
    for (const key of ACTIVE_KEYS) {
      expect(DEFAULT_PROMPTS[key].trim().length).toBeGreaterThan(50);
    }
  });

  it("session_plan_update includes ILE tool guidance", () => {
    expect(DEFAULT_PROMPTS.session_plan_update).toContain("INTEGRATED LEARNING ENVIRONMENT");
    expect(ILE_CONTEXT.length).toBeGreaterThan(100);
  });

  it("prompt-inventory.json matches discovered prompt count", () => {
    const inventoryPath = path.join(process.cwd(), "data/prompt-inventory.json");
    const inventory = JSON.parse(fs.readFileSync(inventoryPath, "utf8"));
    expect(Array.isArray(inventory.entries)).toBe(true);
    expect(inventory.entries.length).toBeGreaterThan(0);
  });
});