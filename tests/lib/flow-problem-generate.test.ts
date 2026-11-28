import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH,
  flowCanGenerateProblemFromArtifacts,
  flowProblemGenerateInput,
  generateFlowProblemFromArtifacts,
  openingWorkFromArtifactProblem,
} from "@/lib/flow-problem-generate";
import {
  acceptProductFlowPublish,
  emptyProductFlowDraft,
  parseGenerateProblemOnOpen,
  productFlowWizardCanAdvance,
} from "@/lib/product-flow";
import { applyVerificationCommand, emptyVerificationState } from "@/lib/verification-flow";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

const ARTIFACT = {
  name: "brief.pdf",
  mimeType: "application/pdf",
  xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
};

describe("generate problem from artifacts", () => {
  it("parses author input and refuses empty artifacts", async () => {
    expect(DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH).toBe("/api/dashboard/protocols/generate-problem");
    expect(flowCanGenerateProblemFromArtifacts([])).toBe(false);
    expect(flowCanGenerateProblemFromArtifacts([ARTIFACT])).toBe(true);
    expect(parseGenerateProblemOnOpen("true")).toBe(true);
    expect(parseGenerateProblemOnOpen(false)).toBe(false);
    const parsed = flowProblemGenerateInput({
      name: "Decoder",
      problem: "Keep this note",
      artifacts: [ARTIFACT],
    });
    expect(parsed).toEqual({
      name: "Decoder",
      problem: "Keep this note",
      artifacts: [ARTIFACT],
    });
    const empty = await generateFlowProblemFromArtifacts({
      name: "",
      problem: "",
      artifacts: [],
    });
    expect(empty).toEqual({ ok: false, error: "Attach at least one artifact." });
  });

  it("writes a problem from attached files", async () => {
    const call = vi.fn(async () => ({
      success: true,
      data: { problem: "  Decode the distance-5 chain from the brief.  " },
    }));
    const forTurn = vi.fn(async () => ({ extraPrompt: "FILE EXCERPT" }));
    const result = await generateFlowProblemFromArtifacts(
      { name: "Decoder", artifacts: [ARTIFACT] },
      { call: call as never, forTurn },
    );
    expect(result).toEqual({
      ok: true,
      problem: "Decode the distance-5 chain from the brief.",
    });
    expect(forTurn).toHaveBeenCalledWith([ARTIFACT.xaiFileId]);
    const firstCall = call.mock.calls[0] as unknown as [
      Array<{ role?: string; content?: string }>,
    ];
    const prompt = firstCall[0].find((message) => message.role === "user")?.content || "";
    expect(prompt).toContain("brief.pdf");
    expect(prompt).toContain("FILE EXCERPT");
  });

  it("lets Author continue with artifacts and generate-on-open", () => {
    const draft = {
      ...emptyProductFlowDraft(),
      name: "Decoder",
      artifacts: [ARTIFACT],
      generateProblemOnOpen: true,
    };
    expect(productFlowWizardCanAdvance("author", draft)).toBe(true);
    const accepted = acceptProductFlowPublish(draft);
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) return;
    expect(accepted.topic).toBe("Decoder");
    expect(accepted.generateProblemOnOpen).toBe(true);

    const missingFiles = acceptProductFlowPublish({
      ...emptyProductFlowDraft(),
      name: "Decoder",
      generateProblemOnOpen: true,
    });
    expect(missingFiles).toEqual({ ok: false, reason: "topic_required" });

    const created = applyVerificationCommand(emptyVerificationState(), {
      type: "create",
      ownerUserId: "owner-1",
      name: accepted.name,
      topic: accepted.topic,
      artifacts: accepted.artifacts,
      generateProblemOnOpen: true,
      id: "vf-gen",
      publicToken: "vtok-gen",
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.flow?.generateProblemOnOpen).toBe(true);
  });

  it("seeds opening work from artifacts when generate-on-open is set", async () => {
    const call = vi.fn(async () => ({
      success: true,
      data: { problem: "Write the decoder failure modes." },
    }));
    const generated = await openingWorkFromArtifactProblem(
      {
        generateProblemOnOpen: true,
        exactProblemOnCanvas: true,
        artifacts: [ARTIFACT],
        name: "Decoder",
      },
      { call: call as never, forTurn: async () => ({ extraPrompt: "" }) },
    );
    expect(generated).toEqual({
      openingWork: "Write the decoder failure modes.",
      openingWorkExact: false,
    });
    expect(
      await openingWorkFromArtifactProblem({
        generateProblemOnOpen: false,
        artifacts: [ARTIFACT],
      }),
    ).toBeNull();
  });

  it("wires Author UI, dashboard generate, persist, and session open", () => {
    const fields = read("components/product-flow/flow-problem-fields.tsx");
    expect(fields).toContain("data-flow-generate-from-artifacts");
    expect(fields).toContain("A new problem is written from these files when a learner opens.");
    expect(fields).toContain('from "@/lib/product-flow"');
    expect(fields).not.toContain("@/lib/flow-problem-generate");
    expect(fields).not.toContain("Generate problem from artifacts");
    expect(fields).not.toContain("Generate problem when a learner opens");
    expect(fields).not.toContain("DASHBOARD_FLOWS_GENERATE_PROBLEM_PATH");
    expect(fields).not.toContain("data-flow-generate-problem");
    expect(fields).not.toContain("data-flow-generate-problem-on-open");
    const wizard = read("components/product-flow/product-flow-wizard.tsx");
    expect(wizard).toContain("onGenerateProblemOnOpenChange");
    expect(wizard).toContain("generateProblemOnOpen: accepted.generateProblemOnOpen");
    expect(read("components/product-flow/flow-publish-review.tsx")).toContain(
      "data-flow-publish-generate-on-open",
    );
    const page = read("components/product-flow/product-flow-page.tsx");
    expect(page).toContain("onGenerateProblemOnOpenChange");
    expect(page).toContain("generateProblemOnOpen");
    expect(read("app/api/dashboard/protocols/generate-problem/route.ts")).toContain(
      "generateFlowProblemFromArtifacts",
    );
    expect(read("app/api/dashboard/protocols/route.ts")).toContain("generateProblemOnOpen");
    expect(read("app/api/dashboard/protocols/[id]/route.ts")).toContain("generateProblemOnOpen");
    expect(read("lib/verification-flow-repository.ts")).toContain("generate_problem_on_open");
    const sql = read("supabase/archive/migrations-pre-20261128/20261121160000_flow_generate_problem_on_open.sql");
    expect(sql).toContain("solve_flows");
    expect(sql).toContain("verify_flows");
    expect(sql).toContain("calibrate_flows");
    expect(sql).toContain("generate_problem_on_open");
  });
});
