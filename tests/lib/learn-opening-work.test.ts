import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  isBareChapterTitle,
  learnOpeningWorkFallback,
  learnOpeningWorkScope,
  resolveLearnOpeningWork,
} from "@/lib/learn-opening-work";
import { normalizeSessionBranchModel } from "@/lib/session-branch-model";

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
    expect(route).toContain('plan.kind === "learn"');
    const field = read("components/session-view/use-session-field.ts");
    expect(field).toContain("seedOpeningWorkCanvas");
    expect(field).toContain("resolveLearnOpeningWork");
    expect(field).not.toContain("(session.problem || \"\").trim()");
    expect(field).toContain("seedChapterWorkCanvas(boardId, text)");
    const load = read("lib/session-branch-field-load.ts");
    expect(load).toContain("openingWork");
    expect(load).toContain("resolveLearnOpeningWork");
  });
});
