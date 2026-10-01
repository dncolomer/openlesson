/**
 * Context generation for Verification Workspaces: pool growth, parsing,
 * and the shipped Goals / Verification Flows controls.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
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

  it("mounts Context and the generation pools only on a Verification Workspace", () => {
    const owner = availableWorkspaceSections({
      isOwner: true,
      workspaceKind: "knowledge_region",
    });
    expect(owner).toContain("context");
    expect(
      resolveActiveSection("context", { isOwner: true, workspaceKind: "knowledge_region" }),
    ).toBe("context");
    expect(availableWorkspaceSections({ isOwner: true })).toContain("context");
    expect(availableWorkspaceSections({ isOwner: true })).not.toContain("verification_flows");

    const hosts = read("components/workspace-view/workspace-section-hosts.tsx");
    expect(hosts).toContain("WorkspaceContextPanel");
    expect(hosts).toContain('visibleSections.includes("context")');
    expect(hosts).toContain("contextGeneration={isKnowledgeRegionWorkspace(plan.workspace_kind)}");
    const context = read("components/WorkspaceContextPanel.tsx");
    expect(context).toContain("WorkspaceDantesSearch");
    expect(context).toContain("WorkspaceExternalAddLinkForm");
    expect(context).toContain("WorkspaceNotesFilesPanel");

    const goals = read("components/WorkspaceGoalsPanel.tsx");
    expect(goals).toContain('kind="goals"');
    expect(goals).toContain("contextGeneration");
    const flows = read("components/VerificationFlowsPanel.tsx");
    expect(flows).toContain('kind="verification_flow"');
    const pool = read("components/ContextGenerationPool.tsx");
    expect(pool).toContain("Generate goals from context");
    expect(pool).toContain("Generate topic + questions from context");
    expect(pool).toContain("appendGeneratedGoals");
    expect(pool).toContain("appendGeneratedFlows");
    expect(pool).toContain("disabled={busy}");
    expect(pool).not.toContain("disabled={pool.length");
    expect(pool).toContain("Clear pool");
    expect(pool).toContain("data-context-generation-clear");
    expect(pool).toContain("disabled={busy || pool.length === 0}");
    expect(pool).toContain("Modifier prompt");
    expect(pool).toContain("data-context-generation-modifier");
    expect(pool).toContain("modifier: modifier.trim()");
    const route = read("app/api/workspace/context-generation/route.ts");
    expect(route).toContain("generateContextCandidates");
    expect(route).toContain("formatContextGenerationSource");
    expect(route).toContain("callXaiJSON");
    expect(route).toContain("loadWorkspacePromptContext");
    expect(route).toContain('typeof body.modifier === "string" ? body.modifier : ""');
    expect(route).toContain("modifier,");
  });
});
