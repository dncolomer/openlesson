import { describe, expect, it } from "vitest";
import {
  composePrompt,
  PROMPT_SYSTEM_VERSION,
  TIM_SYSTEM_ROLE,
  WORKSPACE_ONTOLOGY,
} from "@/lib/prompt-kernel";
import { buildPerformanceReportInstructions } from "@/lib/pow-api/performance-report";
import { buildProofOfWorkSchemaInstructions } from "@/lib/pow-api/proof-of-work-schema";

describe("prompt kernel", () => {
  it("exports a versioned kernel and ontology", () => {
    expect(PROMPT_SYSTEM_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(WORKSPACE_ONTOLOGY).toContain("Workspaces");
    expect(WORKSPACE_ONTOLOGY).toContain("do not include an interruption");
    expect(WORKSPACE_ONTOLOGY).not.toContain("Trace Interruption Model");
    expect(WORKSPACE_ONTOLOGY).toContain("ghc_score");
    expect(TIM_SYSTEM_ROLE).toContain("expected free energy");
    expect(TIM_SYSTEM_ROLE).toContain("independent external service");
  });

  it("composePrompt layers ontology and task", () => {
    const composed = composePrompt({
      ontology: "full",
      surface: "SURFACE: test",
      task: "TASK: do the thing",
    });
    expect(composed.indexOf("WORKSPACE ONTOLOGY")).toBeLessThan(composed.indexOf("SURFACE: test"));
    expect(composed.indexOf("SURFACE: test")).toBeLessThan(composed.indexOf("TASK: do the thing"));
  });

  it("performance and PoW schema builders consume ontology (shipped wiring)", () => {
    const perf = buildPerformanceReportInstructions(null, "Activate trial");
    expect(perf).toContain("WORKSPACE ONTOLOGY");
    expect(perf).toContain("SCORE GENERATION CONTEXT");
    expect(perf).toContain("verification");
    expect(perf).toContain("ghc_score");
    expect(perf).toMatch(/observation|action|stash|submit/i);

    const schema = buildProofOfWorkSchemaInstructions(
      { definition: "Evaluate onboarding readiness" },
      null,
      undefined,
    );
    expect(schema).toContain("WORKSPACE ONTOLOGY");
    expect(schema).toContain("continuous");
    expect(schema).toContain("ghc_score");
    expect(schema).toContain("expected-free-energy interruption");
  });
});
