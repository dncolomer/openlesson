/**
 * Exercise TAP: interaction kind normalize/create path + exercise pure logic + shell resolve.
 * Drives shipped helpers — no mocks of units under test.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  normalizeTapInteractionKind,
  resolveTapInteractionKindFromBody,
  TAP_INTERACTION_KIND_DEFAULT,
} from "@/lib/pow-api/tap-link-config";
import {
  buildExercisePromptText,
  buildExerciseRemoveTracePayload,
  buildExerciseStashTracePayload,
  buildExerciseSubmitTracePayload,
  emptyExerciseDualLists,
  demoteExerciseSubmissionToStash,
  promoteExerciseStashToSubmission,
  resolveExercisePromptAfterIntro,
  resolveTapShellFromSession,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
} from "@/lib/exercise-tap";
import { readExerciseTapSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("normalizeTapInteractionKind / resolveTapInteractionKindFromBody", () => {
  it("defaults to conversational when omitted or invalid", () => {
    expect(normalizeTapInteractionKind(undefined)).toBe("conversational");
    expect(normalizeTapInteractionKind(null)).toBe("conversational");
    expect(normalizeTapInteractionKind("")).toBe("conversational");
    expect(normalizeTapInteractionKind("bogus")).toBe("conversational");
    expect(resolveTapInteractionKindFromBody({})).toBe(TAP_INTERACTION_KIND_DEFAULT);
    expect(resolveTapInteractionKindFromBody({})).toBe("conversational");
  });

  it("accepts exercise via kind string, checkbox flags, and aliases", () => {
    expect(normalizeTapInteractionKind("exercise")).toBe("exercise");
    expect(normalizeTapInteractionKind("Exercise")).toBe("exercise");
    expect(normalizeTapInteractionKind(true)).toBe("exercise");
    expect(normalizeTapInteractionKind("yes")).toBe("exercise");
    expect(resolveTapInteractionKindFromBody({ interaction_kind: "exercise" })).toBe("exercise");
    expect(resolveTapInteractionKindFromBody({ interactionKind: "exercise" })).toBe("exercise");
    expect(resolveTapInteractionKindFromBody({ exercise: true })).toBe("exercise");
    expect(resolveTapInteractionKindFromBody({ isExercise: true })).toBe("exercise");
    expect(resolveTapInteractionKindFromBody({ is_exercise: "on" })).toBe("exercise");
  });

  it("accepts conversational explicitly and false checkbox", () => {
    expect(normalizeTapInteractionKind("conversational")).toBe("conversational");
    expect(normalizeTapInteractionKind("dialogue")).toBe("conversational");
    expect(normalizeTapInteractionKind(false)).toBe("conversational");
    expect(resolveTapInteractionKindFromBody({ exercise: false })).toBe("conversational");
    expect(resolveTapInteractionKindFromBody({ interaction_kind: "conversational" })).toBe(
      "conversational",
    );
  });
});

describe("create TAP link interaction_kind wiring", () => {
  it("create module resolves interaction kind and persists interaction_kind", () => {
    const tap = read("lib/pow-api/create-tap-link.ts");
    expect(tap).toContain("resolveTapInteractionKindFromBody");
    expect(tap).toContain("interaction_kind");
    expect(tap).toMatch(/interaction_kind:\s*interactionKind/);
    expect(tap).toContain("interaction_kind");
    // Does not overload facilitator mode
    expect(tap).toMatch(/mode:\s*"curious"/);
  });

  it("list routes return interaction_kind", () => {
    expect(read("app/api/workspace/tap-links/route.ts")).toContain("interaction_kind");
    expect(read("app/api/v3/pow/workspaces/[id]/tap-links/route.ts")).toContain(
      "interaction_kind",
    );
  });

  it("migration adds interaction_kind default conversational", () => {
    const mig = read("supabase/migrations/20260727120000_tap_interaction_kind.sql");
    expect(mig).toContain("interaction_kind");
    expect(mig).toContain("conversational");
    expect(mig).toContain("exercise");
    expect(mig).toContain("default 'conversational'");
    expect(mig).toContain("workspace_tap_sessions");
  });
});

describe("buildExercisePromptText", () => {
  it("returns empty without explicit exercise/opening text (no pure title/description shells)", () => {
    const text = buildExercisePromptText({
      blockTitle: "Binary search",
      blockDescription: "Find target in sorted array with O(log n) comparisons.",
    });
    expect(text).toBe("");
  });

  it("keeps explicit exercise body; conversational Teach me alone is not rewritten into domain shells", () => {
    const conversational = buildExercisePromptText({
      openingQuestion: 'Teach me what you learned about "Binary search".',
      blockTitle: "Binary search",
      blockDescription: "Locate a key using mid-point halving.",
    });
    // keepRawExerciseText may pass conversational through; must not invent pure domain shell
    expect(conversational).not.toMatch(/attachments\s*:|Given parameters\s+A\s*=/i);

    const explicit = buildExercisePromptText({
      exerciseText: "Locate a key using mid-point halving; box the number of comparisons.",
      blockTitle: "Binary search",
    });
    expect(explicit.startsWith("Exercise:")).toBe(true);
    expect(explicit).toMatch(/mid-point|halving|comparisons/i);
    expect(explicit.toLowerCase()).not.toMatch(/out loud/);
  });

  it("keeps free-form exercise text, strips stage directions, and is idempotent", () => {
    const raw = buildExercisePromptText({
      openingQuestion: "What is amortized analysis?",
      blockTitle: "Amortized analysis",
    });
    expect(raw).toContain("amortized analysis");
    expect(raw.toLowerCase()).not.toMatch(/out loud|think aloud/);
    expect(raw.startsWith("Exercise:")).toBe(true);

    const cleanedLegacy = buildExercisePromptText({
      exerciseText: "Solve out loud: prove O(log n) for heapify.",
    });
    expect(cleanedLegacy.toLowerCase()).not.toMatch(/out loud/);
    expect(cleanedLegacy.toLowerCase()).toMatch(/heapify|o\(log n\)/);

    // Idempotent: re-running on Exercise: prompt must not double-frame.
    const serverPrompt = buildExercisePromptText({
      exerciseText: "Exercise: Binary heap insert and extract-min.",
    });
    expect(serverPrompt.startsWith("Exercise:")).toBe(true);
    const again = buildExercisePromptText({ openingQuestion: serverPrompt });
    expect(again).toBe(serverPrompt);
    expect(again).not.toMatch(/Exercise:\s*Exercise:/i);
  });

  it("does not invent pure shells from workspace title alone", () => {
    const text = buildExercisePromptText({
      workspaceTitle: "Algorithms 101",
      openingQuestion: "Teach me what you learned in Algorithms 101.",
    });
    // May keep conversational opening as-is, but no title-invented domain template
    expect(text).not.toMatch(/attachments\s*:|Given parameters\s+A\s*=/i);
  });

  it("does not invent file-cue shells without explicit exercise text", () => {
    const text = buildExercisePromptText({
      blockTitle: "Query performance",
      blockDescription: "Index choices for multi-tenant Postgres.",
      files: [{ name: "schema.sql" }, { name: "n-plus-one.md", excerpt: "Avoid loops of child queries." }],
    });
    expect(text).toBe("");
  });
});

describe("dual-list stash / submit / remove reducers", () => {
  it("empty → stash (sys1) does not touch submission", () => {
    const first = stashExerciseSpeech(emptyExerciseDualLists(), "I would start with the base case");
    expect(first.added).not.toBeNull();
    expect(first.lists.stash).toHaveLength(1);
    expect(first.lists.submitted).toHaveLength(0);
    expect(first.lists.stash[0].text).toBe("I would start with the base case");

    const second = stashExerciseSpeech(first.lists, "Then induct on n");
    expect(second.lists.stash).toHaveLength(2);
    expect(second.lists.submitted).toHaveLength(0);
  });

  it("stash → promote moves into submission stack", () => {
    const stashed = stashExerciseSpeech(emptyExerciseDualLists(), "base case");
    const id = stashed.added!.id;
    const promoted = promoteExerciseStashToSubmission(stashed.lists, id);
    expect(promoted.moved?.id).toBe(id);
    expect(promoted.lists.stash).toHaveLength(0);
    expect(promoted.lists.submitted).toHaveLength(1);
    expect(promoted.lists.submitted[0].text).toBe("base case");
  });

  it("direct submit puts speech on submission without stash", () => {
    const direct = submitExerciseSpeechDirect(emptyExerciseDualLists(), "spoken solution step");
    expect(direct.lists.stash).toHaveLength(0);
    expect(direct.lists.submitted).toHaveLength(1);
    expect(direct.added?.text).toBe("spoken solution step");
  });

  it("ignores empty stash text", () => {
    const result = stashExerciseSpeech(emptyExerciseDualLists(), "   ");
    expect(result.added).toBeNull();
    expect(result.lists).toEqual(emptyExerciseDualLists());
  });

  it("undo demotes solution → stash without discarding", () => {
    const dual = submitExerciseSpeechDirect(emptyExerciseDualLists(), "keep me");
    const withTwo = submitExerciseSpeechDirect(dual.lists, "move me");
    const moveId = withTwo.added!.id;
    const demoted = demoteExerciseSubmissionToStash(withTwo.lists, moveId);
    expect(demoted.moved?.id).toBe(moveId);
    expect(demoted.moved?.text).toBe("move me");
    expect(demoted.lists.submitted.map((t) => t.text)).toEqual(["keep me"]);
    expect(demoted.lists.stash.map((t) => t.text)).toEqual(["move me"]);
    // Missing id is a no-op
    const noop = demoteExerciseSubmissionToStash(demoted.lists, "missing");
    expect(noop.moved).toBeNull();
    expect(noop.lists).toEqual(demoted.lists);
  });
});

describe("exercise PoW stash/submit/remove payload shapes", () => {
  it("stash payload is system1 pause_finalize / auto_stash", () => {
    const { added } = stashExerciseSpeech(emptyExerciseDualLists(), "stash me", 1_700_000_000_000);
    const deliberate = buildExerciseStashTracePayload({
      tapSessionId: "tap-1",
      workspaceId: "ws-1",
      thought: added!,
    });
    expect(deliberate.trace_type).toBe("system1");
    expect(deliberate.action).toBe("pause_finalize");
    const auto = buildExerciseStashTracePayload({
      tapSessionId: "tap-1",
      workspaceId: "ws-1",
      thought: added!,
      auto: true,
    });
    expect(auto.action).toBe("auto_stash");
  });

  it("submit payload is system2 send", () => {
    const { added } = submitExerciseSpeechDirect(
      emptyExerciseDualLists(),
      "spoken solution step",
      1_700_000_000_000,
    );
    const payload = buildExerciseSubmitTracePayload({
      tapSessionId: "tap-1",
      workspaceId: "ws-1",
      blockId: "block-1",
      thought: added!,
    });
    expect(payload.type).toBe("uncertain_systems_tap_thought_trace");
    expect(payload.trace_type).toBe("system2");
    expect(payload.action).toBe("send");
    expect(payload.tap_session_id).toBe("tap-1");
    expect(payload.text).toBe("spoken solution step");
  });

  it("remove payload is system2 remove (submission undo)", () => {
    const { added } = submitExerciseSpeechDirect(
      emptyExerciseDualLists(),
      "to remove",
      1_700_000_000_100,
    );
    const payload = buildExerciseRemoveTracePayload({
      tapSessionId: "tap-2",
      workspaceId: "ws-2",
      thought: added!,
      timestampMs: 1_700_000_000_200,
    });
    expect(payload.type).toBe("uncertain_systems_tap_thought_trace");
    expect(payload.trace_type).toBe("system2");
    expect(payload.action).toBe("remove");
    expect(payload.text).toBe("to remove");
    expect(payload.thought_id).toBe(added!.id);
    expect(payload.timestamp_ms).toBe(1_700_000_000_200);
  });
});

describe("resolveTapShellFromSession", () => {
  it("routes conversational / exercise / legacy missing → conversational default", () => {
    expect(resolveTapShellFromSession({ interaction_kind: "conversational" })).toBe(
      "conversational",
    );
    expect(resolveTapShellFromSession({ interactionKind: "exercise" })).toBe("exercise");
    expect(
      resolveTapShellFromSession({ initialSession: { interaction_kind: "exercise" } }),
    ).toBe("exercise");
    expect(resolveTapShellFromSession({})).toBe("conversational");
    expect(resolveTapShellFromSession({ initialSession: null })).toBe("conversational");
    expect(resolveTapShellFromSession({ initialSession: {} })).toBe("conversational");
    expect(resolveTapShellFromSession({ interaction_kind: "nope" })).toBe("conversational");
  });
});

describe("resolveExercisePromptAfterIntro", () => {
  it("seeds from topic opening question as solo exercise text", () => {
    const prompt = resolveExercisePromptAfterIntro({
      topicOpeningQuestion: "Explain amortized analysis of dynamic arrays",
      serverOpeningQuestion: "Exercise: ignore me",
      workspaceTitle: "Algo",
    });
    expect(prompt).toContain("amortized analysis");
    expect(prompt.toLowerCase()).toMatch(/exercise|task|explain|complete/);
    expect(prompt.toLowerCase()).not.toMatch(/out loud/);
  });

  it("rewrites legacy out-loud framed server prompts into clean domain tasks", () => {
    const server = 'Exercise: Work through "Heaps" out loud on your own. Explain your reasoning as you go.';
    const resolved = resolveExercisePromptAfterIntro({
      serverOpeningQuestion: server,
      workspaceTitle: "WS",
      blockTitle: "Heaps",
    });
    expect(resolved.toLowerCase()).not.toMatch(/out loud/);
    expect(resolved).toMatch(/Heaps|heap/i);
    expect(resolved.startsWith("Exercise:")).toBe(true);
  });

  it("legacy Work through + rich description strips stage directions only (no pure reframe)", () => {
    const server = 'Exercise: Work through "Heaps" out loud on your own. Explain your reasoning as you go.';
    const resolved = resolveExercisePromptAfterIntro({
      serverOpeningQuestion: server,
      blockTitle: "Heaps",
      blockDescription: "Binary heap insert and extract-min with sift-down.",
    });
    expect(resolved.toLowerCase()).not.toMatch(/out loud/);
    // Must not invent description substance as a pure shell
    expect(resolved).not.toMatch(/attachments\s*:|Given parameters\s+A\s*=/i);
  });

  it("keeps already-framed clean server prompts unchanged", () => {
    const server =
      'Exercise: Demonstrate your understanding of "Heaps": define the core idea and one edge case.';
    expect(
      resolveExercisePromptAfterIntro({
        serverOpeningQuestion: server,
        workspaceTitle: "WS",
      }),
    ).toBe(server);
  });
});

describe("structural: Settings, block tools, separate Exercise UI", () => {
  it("Settings guest-link create wires drill solo style into interaction_kind payload", () => {
    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("data-guest-link-exercise-tap");
    expect(panel).toContain("drillModalitySolo");
    expect(panel).toContain("interaction_kind");
    expect(panel).toContain("resolveProductIntent");
    expect(panel).toContain("productIntent");
  });

  it("block detail exposes Explore/Drill × Dialog/Solo intent tools", () => {
    const card = read("components/BlockDetailCard.tsx");
    expect(card).toContain("onStartExercise");
    expect(card).toContain("onStartIleProject");
    expect(card).toContain("product-intent");
    expect(card).toContain("explore_dialog");
    expect(card).toContain("explore_solo");
    expect(card).toContain("drill_dialog");
    expect(card).toContain("drill_solo");
    expect(card).toContain("onLaunchIntent");
    expect(card).toContain("data-launch-start");
    expect(card).toContain("data-launch-duration-picker");
    expect(card).toContain("onClick={() => setStyle(id)}");

    const item = read("components/SessionItem.tsx");
    expect(item).toContain("handleStartTimed");
    expect(item).toMatch(/interactionKind.*exercise|"exercise"/);
    expect(item).toContain("onLaunchIntent");
    expect(item).toContain('handleStart("project")');
    expect(item).toContain("session_mode: ileMode");
    expect(item).toContain('params.set("minutes"');
  });

  it("Exercise session UI is a separate Stash Submit shell without DialogueSplit/Helios bubbles", () => {
    const client = readExerciseTapSurface();
    const shell = read("components/exercise-tap/ExerciseTapShell.tsx");

    expect(client).toContain("ExerciseTapShell");
    expect(client).toContain("data-exercise-tap-client");
    expect(client).not.toContain("DialogueSplit");
    expect(client).not.toContain("HeliosProbeAvatar");
    expect(client).toContain("stashCurrentTranscription");
    expect(client).toContain("sendCurrentTranscription");
    expect(client).toContain("sendThought");
    expect(client).toContain('event.key === "Enter"');
    expect(client).toContain('event.key === "Delete"');
    expect(client).toContain("resolveExercisePromptAfterIntro");
    expect(client).toContain("interaction_kind: \"exercise\"");

    expect(shell).toContain("data-exercise-tap-shell");
    expect(shell).toContain("data-exercise-tap-stash-submit");
    expect(shell).toContain("ThoughtMemoryPanel");
    expect(shell).toContain("Submit last Thought");
    expect(shell).not.toContain("ExerciseStashHistory");
    expect(shell).not.toContain("ExerciseSubmissionStack");
    expect(shell).not.toContain("DialogueSplit");
  });

  it("start route LLM-authors solo exercise (not template Teach me) for exercise kind", () => {
    const start = read("app/api/workspace-tap-score/start/route.ts");
    expect(start).toContain('interactionKind === "exercise"');
    expect(start).toContain("generateTapExercisePrompt");
    expect(start).toContain("looksLikeConversationalOpening");
    // Conversational generation only on non-exercise branch.
    expect(start).toMatch(
      /interactionKind === "exercise"[\s\S]*else\s*\{[\s\S]*generateTapOpeningQuestion/,
    );
  });

  it("guest + owner entry routes by interaction kind to ExerciseTapClient", () => {
    const guest = read("app/tap/session/[token]/page.tsx");
    expect(guest).toContain("resolveTapShellFromSession");
    expect(guest).toContain("ExerciseTapClient");
    expect(guest).toContain("interaction_kind");
    expect(guest).toContain('shell === "exercise"');

    const owner = read("app/workspace/[id]/tap/page.tsx");
    expect(owner).toContain("resolveTapShellFromSession");
    expect(owner).toContain("ExerciseTapClient");
    expect(owner).toContain("interactionKind");
  });

  it("trace API accepts system2 remove action for submission undo", () => {
    const trace = read("app/api/workspace-tap-score/trace/route.ts");
    const s1 = trace.match(/const SYSTEM1_ACTIONS = new Set<TapSystem1Action>\(\[([\s\S]*?)\]\)/);
    const s2 = trace.match(/const SYSTEM2_ACTIONS = new Set<TapSystem2Action>\(\[([\s\S]*?)\]\)/);
    expect(s1?.[1]).not.toContain('"remove"');
    expect(s2?.[1]).toContain('"remove"');
    const types = read("lib/tap-score-traces.ts");
    const sys1Line = types
      .split("\n")
      .find((line) => line.includes("export type TapSystem1Action"));
    const sys2Line = types
      .split("\n")
      .find((line) => line.includes("export type TapSystem2Action"));
    expect(sys1Line).toBeTruthy();
    expect(sys2Line).toBeTruthy();
    expect(sys1Line).not.toContain("remove");
    expect(sys2Line).toContain("remove");
  });
});
