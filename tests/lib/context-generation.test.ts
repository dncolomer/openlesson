/**
 * Context generation for Verification Workspaces: pool growth, parsing,
 * and the shipped Goals / Verification Flows controls.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  appendGeneratedFlows,
  appendGeneratedGoals,
  buildContextGenerationRequest,
  formatContextGenerationSource,
  generateContextCandidates,
  parseContextFlowGeneration,
  parseContextGoalGeneration,
} from "@/lib/context-generation";
import { availableWorkspaceSections, resolveActiveSection } from "@/lib/workspace-sections";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("context generation pool", () => {
  it("appends every generate click and keeps earlier goals and flows selectable", () => {
    const first = appendGeneratedGoals([], ["Explain a limit", "  ", "Define continuity"]);
    expect(first.map((goal) => goal.text)).toEqual(["Explain a limit", "Define continuity"]);
    const second = appendGeneratedGoals(first, ["Prove the squeeze theorem"]);
    expect(second.map((goal) => goal.text)).toEqual([
      "Explain a limit",
      "Define continuity",
      "Prove the squeeze theorem",
    ]);
    expect(first).toHaveLength(2);

    const flows = appendGeneratedFlows([], [
      { topic: "Limits", questions: ["What is a limit?", " "] },
      { topic: "  ", questions: ["unused"] },
    ]);
    const more = appendGeneratedFlows(flows, [
      { topic: "Series", questions: ["What is a series?"] },
    ]);
    expect(more.map((flow) => flow.topic)).toEqual(["Limits", "Series"]);
    expect(more[0]?.questions).toEqual(["What is a limit?"]);
    expect(flows).toHaveLength(1);
  });

  it("parses model output and asks for new items beyond the pool", async () => {
    const source = formatContextGenerationSource({
      title: "Calculus",
      notes: "Epsilon-delta proofs and continuity.",
      resources: [{ title: "Stewart", url: "https://example.test/stewart", description: "Ch. 2" }],
      files: [{ name: "notes.pdf" }],
    });
    expect(source).toContain("Epsilon-delta");
    expect(source).toContain("Stewart");
    expect(source).toContain("notes.pdf");
    expect(formatContextGenerationSource({})).toBe("");

    const request = buildContextGenerationRequest({
      kind: "goals",
      contextText: source,
      avoid: ["Explain a limit"],
    });
    expect(request.instructions).toContain('"goals"');
    expect(request.user).toContain("Explain a limit");
    expect(request.user).toContain("Epsilon-delta");

    const flowRequest = buildContextGenerationRequest({
      kind: "verification_flow",
      contextText: source,
      avoid: ["Limits"],
    });
    expect(flowRequest.instructions).toContain("topic");
    expect(flowRequest.user).toContain("Limits");
    expect(flowRequest.modifier).toBe("");
    expect(flowRequest.user).not.toContain("Modifier prompt");

    const steered = buildContextGenerationRequest({
      kind: "goals",
      contextText: source,
      modifier: "  Prefer proofs over definitions  ",
    });
    expect(steered.modifier).toBe("Prefer proofs over definitions");
    expect(steered.user).toContain("Modifier prompt:\nPrefer proofs over definitions");
    expect(steered.instructions).toContain("modifier prompt");

    expect(parseContextGoalGeneration({ goals: ["Ship a proof", { text: "Name a theorem" }, ""] })).toEqual([
      "Ship a proof",
      "Name a theorem",
    ]);
    expect(
      parseContextFlowGeneration({
        flows: [{ topic: "Continuity", questions: ["When is f continuous?", { text: "Give a counterexample" }] }],
      }),
    ).toEqual([
      { topic: "Continuity", questions: ["When is f continuous?", "Give a counterexample"] },
    ]);

    const generated = await generateContextCandidates({
      kind: "verification_flow",
      contextText: source,
      avoid: ["Limits"],
      modifier: "Stay with series",
      complete: async (built) => {
        expect(built.avoid).toEqual(["Limits"]);
        expect(built.modifier).toBe("Stay with series");
        expect(built.user).toContain("notes.pdf");
        expect(built.user).toContain("Stay with series");
        return { flows: [{ topic: "Derivatives", questions: ["What is a derivative?"] }] };
      },
    });
    expect(generated.flows[0]?.topic).toBe("Derivatives");
    expect(generated.goals).toEqual([]);
  });

});
