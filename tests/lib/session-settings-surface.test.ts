/**
 * Pre-session settings for Prepare, Learn, Drill, and Verify use the TAP
 * briefing card. Learn does not render the three-tab TAP Learning pregame as that screen.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ILE_LIVE_SETTINGS_KNOBS } from "@/lib/learn-pregame-settings";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("shared TAP settings surface", () => {
  const briefing = read("components/TapBriefingConfig.tsx");
  const learn = read("components/session-view/session-welcome-modal.tsx");
  const setup = read("components/session-view/product-flow-setup-screen.tsx");
  const prepare = read("components/scout-tap/scout-tap-phases.tsx");
  expect(existsSync(join(ROOT, "components/exercise-tap/exercise-tap-phases.tsx"))).toBe(false);

  const verify = read("components/tap-score/tap-score-phases.tsx");

  it("the TAP briefing card offers duration choices and spoken language", () => {
    expect(briefing).toContain("data-tap-briefing-config");
    expect(briefing).toContain("DURATIONS.map");
    expect(briefing).toContain("spokenLocales.map");
    expect(briefing).toContain("showDurationPicker");
  });

  it("Learn settings render that card and the knobs that still change the session", () => {
    expect(learn).toContain("<TapBriefingConfig");
    expect(learn).toContain("showDurationPicker={false}");
    expect(learn).toContain("<TapAestheticSection");
    expect(learn).not.toContain("AestheticPicker");
    expect(learn).toContain("selectedAesthetic?.previewImage");
    expect(learn).toContain('kind="shortcuts"');
    expect(learn).toContain("conversationLanguage={tutoringLanguage}");
    expect(learn).toContain("wideLanguage");
    expect(briefing).toContain('data-tap-conversation-language');
    expect(briefing).toContain("w-full grid-cols-2 gap-2 sm:grid-cols-4");
    expect(briefing).toContain("mx-auto flex w-full max-w-xl flex-col gap-8");
    expect(briefing).toContain("grid grid-cols-3 gap-2");
    expect(learn).not.toContain("data-ile-pregame-tabs");
    expect(learn).not.toContain("data-ile-pregame-tab=");
    expect(learn).not.toContain("ile-pregame-panel-economy");
    expect(learn).not.toContain("ile-pregame-panel-difficulty");
    expect(learn).not.toContain("ile-pregame-panel-other");
    expect(ILE_LIVE_SETTINGS_KNOBS.map((knob) => knob.id)).toEqual([
      "spokenLanguage",
    ]);
    expect(learn).not.toContain("data-ile-session-chapter-count");
    expect(learn).not.toContain("data-ile-pow-expense-slider");
    for (const knob of ILE_LIVE_SETTINGS_KNOBS) {
      if (knob.id === "spokenLanguage") {
        expect(briefing).toContain(knob.attribute);
        continue;
      }
      expect(learn, knob.id).toContain(knob.attribute);
    }
    expect(learn).toContain("data-ile-confirm-settings");
    expect(learn).not.toContain("data-ile-pregame-tabs");
    expect(learn).not.toContain("data-ile-insight-slot-slider");
    expect(learn).not.toContain("data-ile-canvas-timer-slider");
    expect(learn).not.toContain("data-ile-gather-max-slider");
    expect(learn).not.toContain("data-ile-pregame-difficulty-toggle");
    expect(learn).not.toContain("data-ile-browser-inference");
    expect(learn).not.toContain("data-ile-learn-presets");
    expect(learn).not.toContain("applyIleLearnPreset");
    expect(learn).not.toContain("ILE_LEARN_PRESETS");
    expect(learn).not.toContain("data-ile-session-insight-goal");
    expect(learn).not.toContain("data-ile-min-insights-slider");
    expect(learn).not.toContain("data-ile-silence-lock-minutes");
    expect(learn).not.toContain("data-ile-pregame-preset");
    expect(read("components/SessionView.tsx")).not.toContain("resetIleWorkCanvasSceneOnTimerExpiry");
  });

  it("Prepare, Drill, and Verify settings still use the same briefing card and aesthetic column", () => {
    expect(setup).toContain("SessionWelcomeModal");
    expect(setup).toContain("data-product-flow-setup");
    for (const src of [prepare, verify]) {
      expect(src).toContain("<ProductFlowSetupScreen");
      expect(src).not.toContain("data-ile-pregame-tabs");
    }
    expect(prepare).toContain("data-calibrate-start");
    expect(learn).toContain("SessionStartShell");
    expect(learn).toContain("wideLanguage");
    expect(verify).toContain("FLOW_END_KICKERS.verify");
    expect(read("components/CalibrationFlowRunner.tsx")).toContain("<ProductFlowSetupScreen");
    expect(read("components/VerificationFlowRunner.tsx")).toContain("initialMinutes={durationMinutes}");
    expect(read("components/VerificationFlowRunner.tsx")).toContain("lockDuration");
  });

  it("every first settings screen mounts Back to workspace", () => {
    const back = read("components/session-view/session-start-back-button.tsx");
    expect(back).toContain("data-session-back-to-workspace");
    expect(learn).toContain("SessionStartBackButton");
    expect(learn).toContain('t("session.backToDashboard")');
    expect(setup).toContain("onBackToWorkspace");
    expect(learn).toContain("data-ile-back-to-workspace");
    expect(prepare).toContain("onSettingsBackToWorkspace");
    expect(verify).toContain("onBackToWorkspace");
    const scoutClient = read("components/scout-tap/ScoutTapClient.tsx");
    const tapClient = read("components/TapScoreClient.tsx");
    expect(existsSync(join(ROOT, "components/ExerciseTapClient.tsx"))).toBe(false);

    expect(scoutClient).toContain("onSettingsBackToWorkspace=");
    expect(scoutClient).toContain("resolvedWorkspaceId && !privateToken");
    expect(tapClient).toContain("onBackToWorkspace=");
    expect(tapClient).toContain("resolvedWorkspaceId && !privateToken && !localOpening");
  });
});
