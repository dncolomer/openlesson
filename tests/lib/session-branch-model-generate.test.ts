import { beforeEach, describe, expect, it, vi } from "vitest";

const { callXai } = vi.hoisted(() => ({ callXai: vi.fn() }));

vi.mock("@/lib/xai-client", async () => {
  const actual = await vi.importActual<typeof import("@/lib/xai-client")>("@/lib/xai-client");
  return { ...actual, callXai };
});

import {
  continueSessionBranchModel,
  generateSessionBranchModel,
  generateSessionBranchOpening,
  nextSessionBranchSlices,
  tokensForNodes,
} from "@/lib/session-branch-model-generate";
import { SESSION_BRANCH_TARGET_COUNT } from "@/lib/session-branch-model";

type ChatMessage = { role: string; content: string };
type ChatConfig = { maxTokens?: number; fetchTimeout?: number; retries?: number };

function promptOf(messages: ChatMessage[]): string {
  return messages.find((message) => message.role === "user")?.content ?? "";
}

function node(title: string, extra: Record<string, unknown> = {}) {
  return {
    title,
    question: `What still has to be true about ${title}?`,
    territory: `${title} stays distinct.`,
    observation: `${title} is open on the board.`,
    closePrice: 20,
    keepPrice: 35,
    discardPrice: 50,
    insightPrice: 65,
    closeLeads: "Close leads on.",
    keepLeads: "Keep leads on.",
    discardLeads: "Discard leads on.",
    insightLeads: "Insight leads on.",
    closeObservation: `Closing ${title} settles it.`,
    keepObservation: `Keeping ${title} asks for more.`,
    discardObservation: `Discarding ${title} leaves it.`,
    insightObservation: `Insight on ${title} waits.`,
    ...extra,
  };
}

function regionPayload() {
  return {
    premise: "A war can be wrong even when the cause is serious.",
    ...node("Premise"),
    regions: Array.from({ length: 6 }, (_, index) => node(`Region ${index + 1}`)),
  };
}

function replyFor(prompt: string): { success: boolean; data?: unknown; error?: string } {
  if (prompt.includes("Write the premise")) {
    return { success: true, data: regionPayload() };
  }
  const avenueMatch = prompt.match(/Write exactly (\d+) avenues for region (\d+)/);
  if (avenueMatch) {
    const count = Number(avenueMatch[1]);
    const region = Number(avenueMatch[2]);
    return {
      success: true,
      data: {
        avenues: Array.from({ length: count }, (_, index) => node(`Avenue ${region}.${index + 1}`, { region })),
      },
    };
  }
  const lines = [...prompt.matchAll(/^(\d+)\.(\d+) /gm)];
  if (lines.length) {
    return {
      success: true,
      data: {
        inquiries: lines.flatMap((line) => {
          const region = Number(line[1]);
          const avenue = Number(line[2]);
          return Array.from({ length: 3 }, (_, index) =>
            node(`Inquiry ${region}.${avenue}.${index + 1}`, { region, avenue }),
          );
        }),
      },
    };
  }
  return { success: false, error: "unexpected prompt" };
}

describe("generateSessionBranchModel", () => {
  beforeEach(() => {
    callXai.mockReset();
  });

  it("refuses an empty chapter without calling xAI", async () => {
    const result = await generateSessionBranchModel({ chapterTitle: " ", chapterBrief: null });
    expect(result).toEqual({ ok: false, error: "A chapter is required." });
    expect(callXai).not.toHaveBeenCalled();
  });

  it("builds the full field from small slices", async () => {
    let inFlight = 0;
    let maxInFlight = 0;
    callXai.mockImplementation(async (messages: ChatMessage[], config: ChatConfig) => {
      inFlight += 1;
      maxInFlight = Math.max(maxInFlight, inFlight);
      await Promise.resolve();
      inFlight -= 1;
      expect(config.fetchTimeout).toBe(90_000);
      expect(config.retries).toBe(2);
      expect(config.maxTokens ?? 0).toBeLessThan(12_000);
      return replyFor(promptOf(messages));
    });

    const result = await generateSessionBranchModel({
      chapterTitle: "Just war",
      chapterBrief: "When is a war permitted?",
    });

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.branches).toHaveLength(SESSION_BRANCH_TARGET_COUNT);
    expect(maxInFlight).toBeGreaterThan(1);
    expect(maxInFlight).toBeLessThanOrEqual(4);

    const calls = callXai.mock.calls.map((call) => ({
      prompt: promptOf(call[0] as ChatMessage[]),
      maxTokens: (call[1] as ChatConfig).maxTokens,
    }));
    const regions = calls.filter((call) => call.prompt.includes("Write the premise"));
    const avenues = calls.filter((call) => call.prompt.includes("avenues for region"));
    const inquiries = calls.filter((call) => call.prompt.includes("Avenues to go further into"));
    expect(regions).toHaveLength(1);
    expect(regions[0]?.maxTokens).toBe(6000);
    expect(avenues).toHaveLength(6);
    expect(avenues.every((call) => call.maxTokens === tokensForNodes(4))).toBe(true);
    expect(avenues.every((call) => (call.prompt.match(/^\d+\. /gm) ?? []).length === 1)).toBe(true);
    expect(inquiries).toHaveLength(12);
    expect(inquiries.every((call) => call.maxTokens === tokensForNodes(6))).toBe(true);
    expect(inquiries.every((call) => (call.prompt.match(/^\d+\.\d+ /gm) ?? []).length === 2)).toBe(true);
    expect(calls.some((call) => call.prompt.includes("for every region"))).toBe(false);
    expect(
      result.model.branches
        .filter((branch) => branch.parentId)
        .every((branch) => branch.question.includes("?")),
    ).toBe(true);
    const firstConfig = JSON.stringify(callXai.mock.calls[0]?.[1] ?? {});
    expect(firstConfig).toContain('"question"');
    expect(promptOf(callXai.mock.calls[0]?.[0] as ChatMessage[])).toMatch(/original interrogative sentence/i);
  });

  it("returns a slice timeout and does not ask for inquiries", async () => {
    callXai.mockImplementation(async (messages: ChatMessage[]) => {
      const prompt = promptOf(messages);
      if (prompt.includes("Write the premise")) return { success: true, data: regionPayload() };
      return { success: false, error: "The operation was aborted due to timeout" };
    });

    const result = await generateSessionBranchModel({ chapterTitle: "Just war", chapterBrief: "A cause" });
    expect(result).toEqual({ ok: false, error: "The operation was aborted due to timeout" });
    const prompts = callXai.mock.calls.map((call) => promptOf(call[0] as ChatMessage[]));
    expect(prompts.some((prompt) => prompt.includes("Avenues to go further into"))).toBe(false);
    expect(prompts.filter((prompt) => prompt.includes("avenues for region"))).toHaveLength(6);
  });
});

describe("session field opens before the rest is written", () => {
  beforeEach(() => {
    callXai.mockReset();
  });

  it("opens after one region call and does not wait for avenues", async () => {
    callXai.mockImplementation(async (messages: ChatMessage[], config: ChatConfig) => {
      expect(config.fetchTimeout).toBe(90_000);
      expect(config.maxTokens).toBe(2500);
      const prompt = promptOf(messages);
      expect(prompt).toContain("exactly 1 region");
      expect(prompt).not.toContain("avenues for region");
      return {
        success: true,
        data: {
          premise: "A war can be wrong even when the cause is serious.",
          ...node("Premise"),
          regions: [node("Region 1")],
        },
      };
    });
    const result = await generateSessionBranchOpening({
      chapterTitle: "Just war",
      chapterBrief: "When is a war permitted?",
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.branches.map((branch) => branch.id)).toEqual(["root", "r1"]);
    expect(result.continuation.regions).toHaveLength(1);
    expect(nextSessionBranchSlices(result.continuation).every((slice) => slice.kind === "region")).toBe(true);
    expect(callXai).toHaveBeenCalledTimes(1);
  });

  it("keeps the opening when one later region times out", async () => {
    const opening = await (async () => {
      callXai.mockResolvedValue({
        success: true,
        data: {
          premise: "A war can be wrong even when the cause is serious.",
          ...node("Premise"),
          regions: [node("Region 1")],
        },
      });
      return generateSessionBranchOpening({ chapterTitle: "Just war", chapterBrief: "A cause" });
    })();
    expect(opening.ok).toBe(true);
    if (!opening.ok) return;
    callXai.mockReset();
    let regionCalls = 0;
    callXai.mockImplementation(async (messages: ChatMessage[]) => {
      const prompt = promptOf(messages);
      if (prompt.includes("1 more region")) {
        regionCalls += 1;
        if (regionCalls === 1) return { success: false, error: "The operation was aborted due to timeout" };
        return { success: true, data: { region: node(`Region ${regionCalls}`) } };
      }
      return { success: false, error: "unexpected prompt" };
    });
    const result = await continueSessionBranchModel({
      chapterTitle: "Just war",
      chapterBrief: "A cause",
      continuation: opening.continuation,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.model.branches.length).toBeGreaterThan(opening.model.branches.length);
    expect(result.continuation.regionFailures).toBe(1);
    expect(result.continuation.regions.length).toBe(opening.continuation.regions.length + 3);
    expect(result.done).toBe(false);
    expect(callXai.mock.calls.some((call) => promptOf(call[0] as ChatMessage[]).includes("avenues for region"))).toBe(
      false,
    );
  });
});
