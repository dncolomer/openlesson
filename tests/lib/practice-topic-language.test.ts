/**
 * Practice path conversation language: starting topics + Practice First opening
 * must wrap model system prompts with the selected locale via the shared helper.
 * Drives shipped generators with mocked xAI — no re-implementation.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TapScoreBrief } from "@/lib/tap-score";
import { buildConversationLanguageInstruction } from "@/lib/tutoring-languages";
import { buildTapPracticeOpeningQuestionTask, buildTapStartingTopicsTask } from "@/lib/prompt-kernel/surfaces/tap";
import { readFileSync } from "node:fs";
import path from "node:path";

const { callXaiMock, callXaiJSONMock } = vi.hoisted(() => ({
  callXaiMock: vi.fn(),
  callXaiJSONMock: vi.fn(),
}));

vi.mock("@/lib/xai-client", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/xai-client")>();
  return {
    ...actual,
    callXai: (...args: unknown[]) => callXaiMock(...args),
    callXaiJSON: (...args: unknown[]) => callXaiJSONMock(...args),
  };
});

import {
  generateTapOpeningQuestion,
  generateTapStartingTopics,
} from "@/lib/tap-score";

const sampleBrief: TapScoreBrief = {
  plan: {
    id: "ws-1",
    title: "SCRUM fundamentals",
    root_topic: "Agile",
    description: "Learn Scrum roles and events",
    notes: null,
    workspace_goal: "Run a sprint planning conversation",
  },
  nodes: [
    {
      id: "b1",
      title: "Sprint planning",
      description: "Capacity and backlog selection",
      status: "active",
    },
  ],
  sessions: [],
  focusSession: null,
};

function systemTextFromMessages(messages: unknown): string {
  if (!Array.isArray(messages)) return "";
  for (const m of messages) {
    if (!m || typeof m !== "object") continue;
    const rec = m as { role?: string; content?: unknown };
    if (rec.role === "system" && typeof rec.content === "string") return rec.content;
  }
  // Some call sites pass system as first message without role tagging via helpers
  const first = messages[0] as { content?: unknown } | undefined;
  if (first && typeof first.content === "string") return first.content;
  return JSON.stringify(messages);
}

describe("Practice topic + opening language (shipped generators)", () => {
  beforeEach(() => {
    callXaiMock.mockReset();
    callXaiJSONMock.mockReset();
  });

  it("generateTapStartingTopics wraps system prompt with Catalan when conversationLanguage is ca", async () => {
    callXaiJSONMock.mockResolvedValue({
      success: true,
      data: {
        topics: [
          {
            id: "a",
            title: "Títol",
            subtitle: "Subtítol",
            openingQuestion: "Què demostraràs?",
          },
          {
            id: "b",
            title: "Dos",
            subtitle: "Sub",
            openingQuestion: "Com ho proves?",
          },
          {
            id: "c",
            title: "Tres",
            subtitle: "Sub",
            openingQuestion: "On falla?",
          },
        ],
      },
    });

    const topics = await generateTapStartingTopics(sampleBrief, 15, {
      conversationLanguage: "ca",
    });
    expect(topics).toHaveLength(3);
    expect(callXaiJSONMock).toHaveBeenCalledTimes(1);

    const [messages] = callXaiJSONMock.mock.calls[0] as [unknown, unknown];
    const system = systemTextFromMessages(messages);
    const expectedInstr = buildConversationLanguageInstruction("ca");
    expect(expectedInstr).toMatch(/Catalan/i);
    expect(system.startsWith("IMPORTANT:")).toBe(true);
    expect(system).toContain(expectedInstr.slice(0, 40));
    expect(system).toMatch(/Catalan/i);
    expect(system).toMatch(/starting-topic|title|subtitle|openingQuestion/i);
    // Task content still present after language wrap
    expect(system).toMatch(/starting topics|knowledge-verification/i);
  });

  it("generateTapOpeningQuestion (practice warm-up) wraps system prompt with selected language", async () => {
    callXaiMock.mockResolvedValue({
      success: true,
      data: "Digues un exemple senzill de planificació de sprint.",
    });

    const opening = await generateTapOpeningQuestion(sampleBrief, 5, {
      practice: true,
      conversationLanguage: "ca",
    });
    expect(opening.length).toBeGreaterThan(10);
    expect(callXaiMock).toHaveBeenCalledTimes(1);

    const [messages] = callXaiMock.mock.calls[0] as [unknown, unknown];
    const system = systemTextFromMessages(messages);
    expect(system).toMatch(/Catalan/i);
    expect(system).toMatch(/PRACTICE|practice warm-up|easy entry|everyday example/i);
    expect(system).toContain(buildConversationLanguageInstruction("ca").slice(0, 30));
  });

  it("generateTapStartingTopics without locale does not prepend language IMPORTANT block", async () => {
    callXaiJSONMock.mockResolvedValue({
      success: true,
      data: {
        topics: [
          { id: "a", title: "A", subtitle: "s", openingQuestion: "Q1?" },
          { id: "b", title: "B", subtitle: "s", openingQuestion: "Q2?" },
          { id: "c", title: "C", subtitle: "s", openingQuestion: "Q3?" },
        ],
      },
    });

    await generateTapStartingTopics(sampleBrief, 15, { conversationLanguage: "" });
    const [messages] = callXaiJSONMock.mock.calls[0] as [unknown, unknown];
    const system = systemTextFromMessages(messages);
    expect(system.startsWith("IMPORTANT: The learner selected")).toBe(false);
  });
});

describe("Practice topic language structural wiring", () => {
  const root = process.cwd();
  const read = (rel: string) => readFileSync(path.join(root, rel), "utf8");

  it("TapScoreClient and ExerciseTapClient send conversationLanguage on topics + start and reload topics on language change", () => {
    for (const rel of [
      "components/TapScoreClient.tsx",
      "components/ExerciseTapClient.tsx",
    ]) {
      const src = read(rel);
      expect(src).toMatch(/workspace-tap-score\/topics[\s\S]*conversationLanguage/);
      expect(src).toMatch(
        /}, \[phase, workspaceId, blockId, sessionId, privateToken, minutes, conversationLanguage\]/,
      );
    }
    const tapFlow = read("components/tap-score/use-tap-score-flow.ts");
    const exercise = read("components/ExerciseTapClient.tsx");
    expect(tapFlow).toMatch(
      /(?:workspace-tap-score\/start|TAP_SESSION_RUNTIME_PATHS\.start|postTutoringSessionStart)[\s\S]*conversationLanguage/,
    );
    expect(exercise).toMatch(
      /(?:workspace-tap-score\/start|TAP_SESSION_RUNTIME_PATHS\.start|postTutoringSessionStart)[\s\S]*conversationLanguage/,
    );
    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    const exercisePhases = read("components/exercise-tap/exercise-tap-phases.tsx");
    expect(tapPhases).toMatch(/onPracticeFirst=\{\(\) => void startSession\(\{ practice: true \}\)/);
    expect(exercisePhases).toMatch(/onPracticeFirst=\{\(\) => void startSession\(\{ practice: true \}\)/);
    expect(tapFlow).toMatch(/practice[\s\S]*conversationLanguage/);
    expect(exercise).toMatch(/practice[\s\S]*conversationLanguage/);
  });

  it("topics + start API routes pass conversationLanguage into Practice generators", () => {
    const topics = read("app/api/workspace-tap-score/topics/route.ts");
    expect(topics).toMatch(/generateTapStartingTopics\([\s\S]*conversationLanguage/);

    const start = read("app/api/workspace-tap-score/start/route.ts");
    expect(start).toMatch(/generateTapOpeningQuestion\([\s\S]*practice[\s\S]*conversationLanguage/);
    expect(start).toMatch(/generateTapExercisePrompt\([\s\S]*conversationLanguage/);
  });

  it("topic + practice tasks require conversation-language field values when instruction present", () => {
    const topicsTask = buildTapStartingTopicsTask(3);
    expect(topicsTask).toMatch(/conversation-language|conversation language/i);
    expect(topicsTask).toMatch(/title, subtitle, and openingQuestion/i);

    const practiceTask = buildTapPracticeOpeningQuestionTask();
    expect(practiceTask).toMatch(/conversation-language|conversation language/i);

    const ca = buildConversationLanguageInstruction("ca");
    expect(ca).toMatch(/starting-topic|title|subtitle|openingQuestion/i);
    expect(ca).toMatch(/practice warm-up/i);
  });
});
