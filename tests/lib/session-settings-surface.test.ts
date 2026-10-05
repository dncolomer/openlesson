/**
 * Pre-session settings for Prepare, Learn, Drill, and Verify use the TAP
 * briefing card. Learn does not render the three-tab TAP Learning pregame as that screen.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { ILE_LIVE_SETTINGS_KNOBS } from "@/lib/ile-pregame-settings";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("shared TAP settings surface", () => {
  const briefing = read("components/TapBriefingConfig.tsx");
  const learn = read("components/session-view/session-welcome-modal.tsx");
  const prepare = read("components/scout-tap/scout-tap-phases.tsx");
  const drill = read("components/exercise-tap/exercise-tap-phases.tsx");
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
    expect(learn).toContain('kind="shortcuts"');
    expect(learn).toContain("conversationLanguage={tutoringLanguage}");
    expect(learn).toContain("wideLanguage");
    expect(briefing).toContain('data-tap-conversation-language');
    expect(briefing).toContain("w-full grid-cols-2 gap-2 sm:grid-cols-4");
    expect(briefing).toContain("max-w-xs grid-cols-3 gap-2");
    expect(learn).not.toContain("data-ile-pregame-tabs");
    expect(learn).not.toContain("data-ile-pregame-tab=");
    expect(learn).not.toContain("ile-pregame-panel-economy");
    expect(learn).not.toContain("ile-pregame-panel-difficulty");
    expect(learn).not.toContain("ile-pregame-panel-other");
    expect(ILE_LIVE_SETTINGS_KNOBS.map((knob) => knob.id)).toEqual([
      "insightGoal",
      "silenceLock",
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
    expect(learn).toContain("data-ile-learn-presets");
    expect(learn).toContain("applyIleLearnPreset");
    expect(learn).toContain("ILE_LEARN_PRESETS.map");
    expect(learn).not.toContain("data-ile-pregame-preset");
    expect(read("components/SessionView.tsx")).not.toContain("resetIleWorkCanvasSceneOnTimerExpiry");
  });

  it("Prepare, Drill, and Verify settings still use the same briefing card and aesthetic column", () => {
    for (const src of [prepare, drill, verify]) {
      expect(src).toContain("<TapBriefingConfig");
      expect(src).toContain("<TapAestheticSection");
      expect(src).toContain('kind="shortcuts"');
      expect(src).toContain("showDurationPicker=");
      expect(src).toContain("onConversationLanguageChange");
      expect(src).not.toContain("wideLanguage");
      expect(src).not.toContain("data-ile-pregame-tabs");
    }
  });
});
