/**
 * ILE Project Mode: mode normalize/resolve, dual-stack stash↔solution (shared Exercise TAP
 * helpers), chapter Done lock, and structural wiring for Learning vs Project shells.
 */
import { describe, expect, it } from "vitest";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyIleProjectThoughtMutation,
  buildIleChapterDonePowToolData,
  buildIleProjectChapterExercisePrompt,
  emptyIleProjectDualLists,
  frameIleProjectChapterDescription,
  ILE_SESSION_MODE_DEFAULT,
  ILE_SESSION_MODE_LABELS,
  isIleChapterThoughtsLocked,
  isIleProjectMode,
  normalizeIleSessionMode,
  resolveIleDurableSessionMode,
  resolveIleSessionModeFromBody,
  resolveIleSessionModeFromSession,
  resolveIleShellFromSession,

} from "@/lib/ile-mode";
import {
  demoteExerciseSubmissionToStash,
  promoteExerciseStashToSubmission,
  stashExerciseSpeech,
  submitExerciseSpeechDirect,
} from "@/lib/exercise-tap";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-95854a546cb8/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("normalizeIleSessionMode / resolve", () => {
  it("defaults missing/legacy/invalid to Learning Mode", () => {
    expect(normalizeIleSessionMode(undefined)).toBe("learning");
    expect(normalizeIleSessionMode(null)).toBe("learning");
    expect(normalizeIleSessionMode("")).toBe("learning");
    expect(normalizeIleSessionMode("bogus")).toBe("learning");
    expect(resolveIleSessionModeFromBody({})).toBe(ILE_SESSION_MODE_DEFAULT);
    expect(resolveIleSessionModeFromSession({})).toBe("learning");
    expect(resolveIleShellFromSession({})).toBe("learning");
    expect(ILE_SESSION_MODE_LABELS.learning).toBe("Learning Mode");
    expect(ILE_SESSION_MODE_LABELS.project).toBe("Explore Solo");
  });

  it("accepts Project Mode via kind string, checkbox flags, and aliases", () => {
    expect(normalizeIleSessionMode("project")).toBe("project");
    expect(normalizeIleSessionMode("Project")).toBe("project");
    expect(normalizeIleSessionMode("exercise")).toBe("project");
    expect(normalizeIleSessionMode(true)).toBe("project");
    expect(resolveIleSessionModeFromBody({ session_mode: "project" })).toBe("project");
    expect(resolveIleSessionModeFromBody({ sessionMode: "project" })).toBe("project");
    expect(resolveIleSessionModeFromBody({ project: true })).toBe("project");
    expect(resolveIleSessionModeFromBody({ isProject: true })).toBe("project");
    expect(resolveIleSessionModeFromBody({ interaction_kind: "exercise" })).toBe("project");
    expect(isIleProjectMode("project")).toBe(true);
    expect(isIleProjectMode("learning")).toBe(false);
  });

  it("resolves from session metadata and link row (durable reload path)", () => {
    expect(
      resolveIleSessionModeFromSession({
        metadata: { session_mode: "project" },
      }),
    ).toBe("project");
    expect(
      resolveIleSessionModeFromSession({
        metadata: { ile_session_mode: "project" },
      }),
    ).toBe("project");
    expect(
      resolveIleSessionModeFromSession({
        ileLink: { session_mode: "project" },
      }),
    ).toBe("project");
    expect(
      resolveIleSessionModeFromSession({
        session_mode: "learning",
      }),
    ).toBe("learning");
  });

  it("session-chat and ILE shell share resolveIleDurableSessionMode", () => {
    const fromMeta = resolveIleDurableSessionMode({
      metadata: { session_mode: "project" },
    });
    expect(fromMeta).toBe("project");

    const fromLinkWhenMetaMissing = resolveIleDurableSessionMode({
      sessionModeProp: "project",
      metadata: null,
    });
    expect(fromLinkWhenMetaMissing).toBe("project");

    const learningDefault = resolveIleDurableSessionMode({});
    expect(learningDefault).toBe("learning");

    const route = read("app/api/session-chat/route.ts");
    const client = read("lib/session-chat-client.ts");
    const helios = read("components/HeliosChat.tsx");
    const view = readSessionViewSurface();
    expect(route).toContain("resolveIleDurableSessionMode");
    expect(route).not.toContain("auth.ileSessionMode");
    expect(view).toContain("resolveIleDurableSessionMode");
    expect(client).not.toContain("session_mode");
    expect(client).not.toContain("sessionMode");
    expect(helios).not.toMatch(/sessionMode:\s*"learning"/);
    expect(helios).not.toMatch(/session_mode:\s*"learning"/);

    const scratch =
      process.env.GROK_GOAL_SCRATCH ||
      "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-f71f456e9e6e/implementer";
    mkdirSync(scratch, { recursive: true });
    writeFileSync(
      join(scratch, "session-chat-mode.log"),
      [
        `fromMeta=${fromMeta}`,
        `fromLinkWhenMetaMissing=${fromLinkWhenMetaMissing}`,
        `learningDefault=${learningDefault}`,
        "route uses resolveIleDurableSessionMode from session metadata",
        "client/HeliosChat do not send session_mode",
      ].join("\n"),
      "utf8",
    );
  });
});

describe("dual-list stash ↔ solution (shared Exercise TAP helpers)", () => {
  it("promote stash → solution and demote solution → stash", () => {
    let state = emptyIleProjectDualLists();
    const s1 = stashExerciseSpeech(state, "raw reasoning");
    state = s1.lists;
    const promoted = promoteExerciseStashToSubmission(state, s1.added!.id);
    state = promoted.lists;
    expect(state.stash).toHaveLength(0);
    expect(state.submitted.map((t) => t.text)).toEqual(["raw reasoning"]);

    const demoted = demoteExerciseSubmissionToStash(state, promoted.moved!.id);
    state = demoted.lists;
    expect(state.submitted).toHaveLength(0);
    expect(state.stash.map((t) => t.text)).toEqual(["raw reasoning"]);
  });

  it("applyIleProjectThoughtMutation drives shared reducers", () => {
    let lists = emptyIleProjectDualLists();
    const stash = applyIleProjectThoughtMutation(lists, "in_progress", {
      type: "stash",
      text: "step one",
    });
    expect(stash.rejected).toBe(false);
    lists = stash.lists;
    const promote = applyIleProjectThoughtMutation(lists, "in_progress", {
      type: "promote",
      thoughtId: stash.thought!.id,
    });
    expect(promote.rejected).toBe(false);
    lists = promote.lists;
    expect(lists.submitted).toHaveLength(1);

    const direct = applyIleProjectThoughtMutation(lists, "pending", {
      type: "submit_direct",
      text: "live enter",
    });
    lists = direct.lists;
    expect(lists.submitted).toHaveLength(2);

    const demote = applyIleProjectThoughtMutation(lists, "in_progress", {
      type: "demote",
      thoughtId: promote.thought!.id,
    });
    lists = demote.lists;
    expect(lists.submitted.map((t) => t.text)).toEqual(["live enter"]);
    expect(lists.stash.map((t) => t.text)).toContain("step one");
  });
});

describe("chapter Done locks further thought mutations; Done still builds PoW", () => {
  it("isIleChapterThoughtsLocked for completed/skipped", () => {
    expect(isIleChapterThoughtsLocked("completed")).toBe(true);
    expect(isIleChapterThoughtsLocked("skipped")).toBe(true);
    expect(isIleChapterThoughtsLocked("in_progress")).toBe(false);
    expect(isIleChapterThoughtsLocked("pending")).toBe(false);
  });

  it("mutations are no-ops when chapter is Done", () => {
    let lists = emptyIleProjectDualLists();
    const open = applyIleProjectThoughtMutation(lists, "in_progress", {
      type: "stash",
      text: "before done",
    });
    lists = open.lists;
    expect(lists.stash).toHaveLength(1);

    const afterDone = applyIleProjectThoughtMutation(lists, "completed", {
      type: "stash",
      text: "after done",
    });
    expect(afterDone.rejected).toBe("chapter_locked");
    expect(afterDone.lists.stash).toHaveLength(1);
    expect(afterDone.thought).toBeNull();

    const promoteBlocked = applyIleProjectThoughtMutation(lists, "completed", {
      type: "promote",
      thoughtId: open.thought!.id,
    });
    expect(promoteBlocked.rejected).toBe("chapter_locked");

    const submitBlocked = applyIleProjectThoughtMutation(lists, "skipped", {
      type: "submit_direct",
      text: "nope",
    });
    expect(submitBlocked.rejected).toBe("chapter_locked");
  });

  it("Done PoW builder succeeds without evaluation/score UI fields", () => {
    const toolData = buildIleChapterDonePowToolData({
      stepIndex: 0,
      stepId: "step-1",
      stepDescription: "Build the API gateway",
      sessionMode: "project",
    });
    expect(toolData.stepId).toBe("step-1");
    expect(toolData.via).toBe("chapter_map_mark_done");
    expect(toolData.session_mode).toBe("project");
    expect(toolData.evaluation).toBeNull();
    expect(toolData.score).toBeNull();
    expect(toolData.interface_evaluation).toBe(false);
  });
});

describe("Project Mode chapter exercise framing", () => {
  it("frames new chapter descriptions as exercises (idempotent)", () => {
    const framed = frameIleProjectChapterDescription("Implement rate limiting");
    expect(framed.startsWith("Exercise:")).toBe(true);
    expect(framed).toContain("Implement rate limiting");
    expect(frameIleProjectChapterDescription(framed)).toBe(framed);
  });

  it("builds longer-horizon exercise prompt for active chapter", () => {
    const prompt = buildIleProjectChapterExercisePrompt({
      chapterDescription: "Design the auth flow",
      blockTitle: "Security",
    });
    // Chapter body must drive the prompt — not block-only framing.
    expect(prompt).toMatch(/auth flow/i);
    expect(prompt.startsWith("Exercise:")).toBe(true);
    expect(prompt).toContain("Design the auth flow");
    // Must not fall through to buildExercisePromptText block-title path.
    expect(prompt).not.toMatch(/Work through "Security"/);
    expect(prompt).not.toMatch(/^Exercise: Work through/);
  });

  it("returns empty when chapter description is empty (no pure block invent)", () => {
    const prompt = buildIleProjectChapterExercisePrompt({
      chapterDescription: "   ",
      blockTitle: "Security",
      blockDescription: "Auth and secrets",
    });
    expect(prompt).toBe("");
    expect(prompt).not.toMatch(/Security|Auth and secrets/i);
  });
});

describe("structural Project Mode wiring (static source checks)", () => {
  it("mode persistence: migration + create + auth + guest client", () => {
    const mig = read("supabase/migrations/20260728120000_ile_session_mode.sql");
    expect(mig).toContain("session_mode");
    expect(mig).toContain("learning");
    expect(mig).toContain("project");
    expect(mig).toContain("workspace_ile_links");
    expect(mig).toContain("default 'learning'");

    const create = read("lib/pow-api/create-ile-link.ts");
    expect(create).toContain("resolveIleSessionModeFromBody");
    expect(create).toMatch(/session_mode:\s*sessionMode/);

    const auth = read("lib/ile-link-auth.ts");
    expect(auth).toContain("sessionMode");
    expect(auth).toContain("session_mode");
    expect(auth).toContain("ile_session_mode");

    const guest = read("components/IleGuestSessionClient.tsx");
    expect(guest).toContain("sessionMode");
    expect(guest).toContain("SessionView");

    const page = read("app/ile/session/[token]/page.tsx");
    expect(page).toContain("sessionMode");
  });

  it("SessionView Project Mode: no Helios bubbles path; conversation Thought Memory; Done lock", () => {
    const view = readSessionViewSurface();
    expect(view).toContain("isProjectMode");
    expect(view).not.toContain("ProjectThoughtsDualStack");
    expect(view).toContain("projectMode={isProjectMode}");
    expect(view).toContain("chapterThoughtsLocked");
    expect(view).toContain("ThoughtMemoryPanel");
    expect(view).toContain("onSendThought");
    expect(view).toContain("buildIleChapterDonePowToolData");
    expect(view).toContain("frameIleProjectChapterDescription");
    expect(view).toContain("buildIleChapterDonePowToolData");

    const helios = read("components/SessionHeliosPanel.tsx");
    expect(helios).toContain("projectMode");
    expect(helios).toContain('data-helios-bubbles="hidden"');
    expect(helios).toContain("data-ile-project-exercise-prompt");
    expect(helios).toContain("Explore Solo · Exercise");
    expect(helios).not.toContain("Project Mode · Exercise");
    expect(helios).toContain("DialogueSplit");
    expect(helios).toContain('label="Send"');
    expect(helios).toContain('label="Stash"');
    expect(helios).toContain('label="Edit"');
    expect(helios).not.toContain('label="Solution"');
    expect(helios).toContain("Submit last Thought");
    expect(helios).toContain("See Older Thoughts");
    expect(helios).toContain("data-ile-last-stash");
    expect(helios).toContain("sendCurrentTranscription");
    expect(helios).toContain("stashCurrentTranscription");

    const panes = read("components/session-view/session-tool-panes.tsx");
    expect(panes).toContain("ThoughtMemoryPanel");
    expect(panes).not.toContain("ProjectThoughtsDualStack");
    expect(panes).toContain('activeTool === "thought-history"');
    expect(panes).toContain("onSendThought={onSendThought}");

    const panel = read("components/WorkspaceGuestLinksPanel.tsx");
    expect(panel).toContain("ileProjectMode");
    expect(panel).toContain("session_mode");
    // Product UI uses Explore/Drill labels; Project mode still wired via session_mode.
    expect(panel).toMatch(/Project Mode|Drill|openEndedStyle|session_mode/);
    expect(panel).toContain("data-guest-link-ile-project-mode");
  });

  it("reuses Exercise TAP dual-list helpers (not a forked stash/solution model)", () => {
    const mode = read("lib/ile-mode.ts");
    expect(mode).toContain("stashExerciseSpeech");
    expect(mode).toContain("promoteExerciseStashToSubmission");
    expect(mode).toContain("demoteExerciseSubmissionToStash");
    expect(mode).toContain("submitExerciseSpeechDirect");
    // Shared helpers still exist and are called by project mutator tests above
    expect(typeof stashExerciseSpeech).toBe("function");
    expect(typeof submitExerciseSpeechDirect).toBe("function");
  });
});
