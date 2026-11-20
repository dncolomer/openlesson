import { appendFileSync, mkdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  exactProblemOpeningWork,
  isBareChapterTitle,
  learnOpeningWorkFallback,
  learnOpeningWorkScope,
  resolveLearnOpeningWork,
} from "@/lib/learn-opening-work";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";
import {
  seedPreparedOpeningCanvas,
  serializeFlowOpeningCanvasScene,
} from "@/lib/flow-opening-canvas";
import { ileWorkCanvasLiveApply } from "@/lib/learn-work-canvas";
import { commitScene, type LiveExcalidrawAPI } from "@/components/excalidraw-canvas/excalidraw-api";

const ROOT = join(__dirname, "../..");
const { callXai } = vi.hoisted(() => ({ callXai: vi.fn() }));

vi.mock("@/lib/xai-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/xai-client")>("@/lib/xai-client");
  return { ...actual, callXai };
});

import {
  generateLearnOpeningWorkPrompt,
  openingWorkForSessionField,
} from "@/lib/learn-opening-work-generate";

function read(path: string): string {
  return readFileSync(join(ROOT, path), "utf8");
}

function model() {
  return normalizeSessionBranchModel(
    {
      premise: "A Langevin equation is a noisy force law.",
      question: "What force still has to stay after you add the noise?",
      regions: [
        {
          title: "Friction",
          question: "Where does the drag term come from in this trajectory?",
          territory: "Dissipation.",
          observation: "The particle leaks energy into the bath.",
          edgePrice: 12,
        },
        {
          title: "Noise",
          question: "How is the kick related to the friction you just named?",
          territory: "Fluctuation.",
          observation: "The random force matches the drag at equilibrium.",
          edgePrice: 18,
        },
      ],
    },
    "Langevin",
  )!;
}

describe("learn opening work", () => {
  beforeEach(() => {
    callXai.mockReset();
  });

  it("treats the block title as a bare prompt", () => {
    expect(isBareChapterTitle("Langevin", "Langevin")).toBe(true);
    expect(isBareChapterTitle("Langevin.", "Langevin")).toBe(true);
    expect(
      isBareChapterTitle(
        "A pollen grain jitters in water. Write the force balance you would actually use.",
        "Langevin",
      ),
    ).toBe(false);
  });

  it("scopes the opening ring and never falls back to the chapter title", () => {
    const field = model();
    expect(learnOpeningWorkScope(field).map((branch) => branch.id)).toEqual([
      "root",
      "r1",
      "r2",
    ]);
    const fallback = learnOpeningWorkFallback(field, "session-a");
    expect(fallback).toContain("?");
    expect(isBareChapterTitle(fallback, "Langevin")).toBe(false);
    expect(learnOpeningWorkFallback(field, "session-a")).toBe(
      learnOpeningWorkFallback(field, "session-a"),
    );
  });

  it("rejects a generated title dump and keeps a work prompt", () => {
    const field = model();
    expect(resolveLearnOpeningWork(field, "Langevin", "s1")).not.toBe("Langevin");
    expect(resolveLearnOpeningWork(field, "Langevin", "s1")).toBe(
      learnOpeningWorkFallback(field, "s1"),
    );
    expect(
      resolveLearnOpeningWork(
        field,
        "A grain of pollen jitters in a drop of water. Write the force balance you would use before you name the equation.",
        "s1",
      ),
    ).toMatch(/pollen/);
  });

  it("asks xAI for a fresh work prompt grounded in the opening field", async () => {
    callXai.mockResolvedValue({
      success: true,
      data: {
        workPrompt:
          "A grain of pollen jitters in a drop of water. Write the force balance you would use before you name the equation.",
      },
    });
    const field = model();
    const prompt = await generateLearnOpeningWorkPrompt(field);
    expect(prompt).toMatch(/pollen/);
    expect(callXai).toHaveBeenCalledTimes(1);
    const [, config] = callXai.mock.calls[0] as [unknown, { temperature?: number }];
    expect(config.temperature).toBe(0.75);
    const messages = callXai.mock.calls[0][0] as Array<{ content: string }>;
    expect(messages[1]?.content).toContain("Friction");
    expect(messages[1]?.content).toContain("Langevin");
    const resolved = await openingWorkForSessionField(field, "sess-9");
    expect(resolved).toMatch(/pollen/);
  });

  it("falls back to a tree question when xAI fails", async () => {
    callXai.mockResolvedValue({ success: false, error: "down" });
    const field = model();
    const prompt = await openingWorkForSessionField(field, "sess-9");
    expect(prompt).toBe(learnOpeningWorkFallback(field, "sess-9"));
  });

  it("writes the Learn opening onto the canvas instead of the block title", () => {
    const route = read("app/api/learn/session-branch-model/route.ts");
    expect(route).toContain("openingWorkForSessionField");
    expect(route).toContain("openingWork");
    expect(route).toContain("openingWorkExact");
    expect(route).toContain("exactProblemOnCanvas");
    const field = read("components/session-view/use-session-field.ts");
    expect(field).toContain("seedOpeningWorkCanvas");
    expect(field).toContain("resolveLearnOpeningWork");
    expect(field).toContain("exactProblemOpeningWork");
    expect(field).toContain("sessionWantsExactProblemOnCanvas");
    expect(field).toContain("seedChapterWorkCanvas(boardId, text)");
    const load = read("lib/session-branch-field-load.ts");
    expect(load).toContain("openingWork");
    expect(load).toContain("openingWorkExact");
    expect(load).toContain("resolveLearnOpeningWork");
  });

  it("keeps the authored Problem when the flow asks for a 1:1 canvas", async () => {
    const field = model();
    expect(
      resolveLearnOpeningWork(field, "Langevin", "s1", { exactProblem: true }),
    ).toBe("Langevin");
    expect(exactProblemOpeningWork("  Keep this problem.  ")).toBe("Keep this problem.");
    const exact = await openingWorkForSessionField(field, "sess-9", {
      exactProblem: "Write the Langevin force balance for this grain.",
    });
    expect(exact).toBe("Write the Langevin force balance for this grain.");
    expect(callXai).not.toHaveBeenCalled();
  });

  it("seeds a prepared opening scene instead of Exact-problem rewrite", () => {
    const scratch =
      process.env.GROK_GOAL_SCRATCH ||
      "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-8913821ad36e/implementer";
    mkdirSync(scratch, { recursive: true });
    const scene = serializeFlowOpeningCanvasScene({
      elements: [
        {
          id: "prep-1",
          type: "text",
          x: 4,
          y: 4,
          width: 200,
          height: 36,
          text: "Prepared opening board",
          originalText: "Prepared opening board",
          isDeleted: false,
        },
        {
          id: "prep-img",
          type: "image",
          x: 40,
          y: 80,
          width: 160,
          height: 90,
          fileId: "file-solve-1",
          isDeleted: false,
        },
      ],
      appState: {},
      files: {
        "file-solve-1": {
          id: "file-solve-1",
          mimeType: "image/png",
          dataURL: "data:image/png;base64,aaaa",
        },
      },
    });
    const seeded = seedPreparedOpeningCanvas(null, scene);
    expect(seeded.seeded).toBe(true);
    expect(
      seeded.scene.elements.some((el) =>
        String(el.originalText || el.text || "").includes("Prepared opening board"),
      ),
    ).toBe(true);
    const apply = ileWorkCanvasLiveApply(seeded.scene);
    expect(apply.elements.some((el) => el.fileId === "file-solve-1")).toBe(true);
    expect(apply.files["file-solve-1"]).toMatchObject({
      id: "file-solve-1",
      mimeType: "image/png",
    });
    const live: LiveExcalidrawAPI = {
      updateScene: vi.fn(),
      getSceneElements: () => [],
      getAppState: () => ({}),
      getFiles: () => ({}),
      setViewport: vi.fn(),
    };
    expect(
      commitScene(live, {
        elements: apply.elements,
        files: apply.files,
      }),
    ).toBe(true);
    expect(live.updateScene).toHaveBeenCalledWith({
      elements: apply.elements,
      files: apply.files,
    });
    const route = read("app/api/learn/session-branch-model/route.ts");
    expect(route).toContain("openingCanvasScene");
    expect(route).toContain("flowOpeningCanvasHasContent");
    const field = read("components/session-view/use-session-field.ts");
    expect(field).toContain("seedPreparedOpeningCanvas");
    expect(field).toContain("openingScene");
    expect(field).toContain("ileWorkCanvasLiveApply");
    expect(field).toContain("setCanvasApplyFiles");
    const chapter = read("components/session-view/session-chapter-canvas.tsx");
    expect(chapter).toContain("applyFiles={canvasApplyFiles}");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    expect(canvas).toContain("applyFiles");
    expect(canvas).toContain("ileWorkCanvasMergeFiles");
    const load = read("lib/session-branch-field-load.ts");
    expect(load).toContain("openingCanvasScene");
    appendFileSync(
      join(scratch, "opening-scene-tests.log"),
      [
        `seeded=${seeded.seeded}`,
        `routeScene=${route.includes("openingCanvasScene")}`,
        `fieldSeed=${field.includes("seedPreparedOpeningCanvas")}`,
        `solveImageFile=${Boolean(apply.files["file-solve-1"])}`,
        `solveApplyFiles=${field.includes("setCanvasApplyFiles")}`,
        `commitFiles=${JSON.stringify((live.updateScene as ReturnType<typeof vi.fn>).mock.calls[0]?.[0]?.files || {}).includes("file-solve-1")}`,
        "",
      ].join("\n"),
      "utf8",
    );
  });
});
