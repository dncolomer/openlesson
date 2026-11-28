import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  productFlowUnsysGenerateInput,
  runProductFlowUnsysGenerate,
} from "@/lib/flow-unsys-generate";
import { serializeFlowOpeningCanvasScene } from "@/lib/flow-opening-canvas";
import { exampleAuthorUnsysModel } from "@/lib/author-unsys-model";
import { tmpdir } from "node:os";

const ARTIFACT = {
  name: "brief.pdf",
  mimeType: "application/pdf",
  xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
};

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  join(tmpdir(), "openlesson-scratch", "grok-goal-8913821ad36e/implementer");

describe("Unsys generate from prepared canvas", () => {
  it("drives runProductFlowUnsysGenerate from the saved board, not leftover Problem text", async () => {
    const scene = serializeFlowOpeningCanvasScene({
      elements: [
        {
          id: "board-1",
          type: "text",
          x: 0,
          y: 0,
          width: 220,
          height: 40,
          text: "Canvas kernel diagram",
          originalText: "Canvas kernel diagram",
          isDeleted: false,
        },
      ],
      appState: {},
      files: {},
    });
    const parsed = productFlowUnsysGenerateInput({
      kind: "solve",
      name: "Decoder",
      problem: "Leftover problem textarea",
      artifacts: [ARTIFACT],
      openingCanvasScene: scene,
    });
    expect(parsed.fromPreparedCanvas).toBe(true);
    expect(parsed.problem).toContain("Canvas kernel diagram");
    expect(parsed.problem).not.toContain("Leftover problem textarea");
    expect(parsed.artifacts).toEqual([]);

    let capturedProblem = "";
    let capturedArtifacts: unknown = null;
    const result = await runProductFlowUnsysGenerate(
      {
        kind: "solve",
        name: "Decoder",
        problem: "Leftover problem textarea",
        artifacts: [ARTIFACT],
        openingCanvasScene: scene,
      },
      {
        generateFirstLevel: async (input) => {
          capturedProblem = String(input.problem || "");
          capturedArtifacts = input.artifacts;
          return { ok: true, model: exampleAuthorUnsysModel("Decoder") };
        },
      },
    );
    expect(result.ok).toBe(true);
    expect(capturedProblem).toContain("Canvas kernel diagram");
    expect(capturedProblem).not.toContain("Leftover problem textarea");
    expect(capturedArtifacts).toEqual([]);

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "unsys-from-canvas-tests.log"),
      [
        `fromPrepared=${parsed.fromPreparedCanvas}`,
        `problem=${capturedProblem}`,
        `artifactsEmpty=${Array.isArray(capturedArtifacts) && capturedArtifacts.length === 0}`,
        `ok=${result.ok}`,
      ].join("\n"),
      "utf8",
    );
  });
});
