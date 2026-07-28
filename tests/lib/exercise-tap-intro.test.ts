/**
 * Exercise TAP shares conversational TAP intro screens (onboarding guide + briefing config + topics).
 * Start still enters Exercise live shell — not Helios dialogue.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { resolveExercisePromptAfterIntro } from "@/lib/exercise-tap";
import { resolveTapShellFromSession } from "@/lib/exercise-tap";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("Exercise TAP briefing uses shared intro", () => {
  it("mounts SessionOnboardingGuide + TapStartingTopicCards + TapBriefingConfig", () => {
    const client = read("components/ExerciseTapClient.tsx");
    expect(client).toContain("SessionOnboardingGuide");
    expect(client).toContain('variant="tap"');
    expect(client).toContain("TapStartingTopicCards");
    expect(client).toContain("TapBriefingConfig");
    expect(client).toContain("data-exercise-tap-intro");
    expect(client).toContain("data-exercise-briefing");
    expect(client).toContain("/api/workspace-tap-score/topics");
    // Not the old single-panel "Start exercise" blurb as the only intro.
    expect(client).not.toContain("Start exercise");
    expect(client).not.toMatch(/data-exercise-start/);
  });

  it("shared TapBriefingConfig exists and is used by conversational TAP too", () => {
    const config = read("components/TapBriefingConfig.tsx");
    expect(config).toContain("data-tap-briefing-config");
    expect(config).toContain("tap.briefing.sessionLength");
    expect(config).toContain("tap.briefing.conversationLanguage");
    expect(config).toContain("tap.briefing.keyboardShortcuts");

    const conversational = read("components/TapScoreClient.tsx");
    expect(conversational).toContain("SessionOnboardingGuide");
    expect(conversational).toContain("TapStartingTopicCards");
    expect(conversational).toContain("TapBriefingConfig");
    expect(conversational).toContain('variant="tap"');
  });

  it("intro start still enters exercise shell with interaction_kind exercise", () => {
    const client = read("components/ExerciseTapClient.tsx");
    expect(client).toContain('interaction_kind: "exercise"');
    expect(client).toContain("resolveExercisePromptAfterIntro");
    expect(client).toContain("onStartTopic");
    expect(client).toContain("onPracticeFirst");
    expect(client).toContain("ExerciseTapShell");
    expect(client).not.toContain("DialogueSplit");
    expect(client).not.toContain("HeliosProbeAvatar");
  });
});

describe("entry still resolves exercise client; briefing is intro path", () => {
  it("guest/owner routes use ExerciseTapClient for exercise kind", () => {
    expect(resolveTapShellFromSession({ interaction_kind: "exercise" })).toBe("exercise");
    expect(resolveTapShellFromSession({})).toBe("conversational");

    const guest = read("app/tap/session/[token]/page.tsx");
    expect(guest).toContain("ExerciseTapClient");
    expect(guest).toContain("resolveTapShellFromSession");

    const owner = read("app/workspace/[id]/tap/page.tsx");
    expect(owner).toContain("ExerciseTapClient");
  });

  it("resolveExercisePromptAfterIntro drives real start seeding", () => {
    const fromTopic = resolveExercisePromptAfterIntro({
      topicOpeningQuestion: "Prove the loop invariant for binary search",
      workspaceTitle: "Algorithms",
    });
    expect(fromTopic).toContain("binary search");
    expect(fromTopic.toLowerCase()).not.toMatch(/^teach me/);
  });
});
