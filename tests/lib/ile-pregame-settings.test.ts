/**
 * TAP Learning pre-game settings: named presets, extra sliders, Start Session copy,
 * fuller map-type explanation. Drives shipped helpers (no re-implementation).
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  ILE_LEARN_PRESETS,
  ILE_PREGAME_DIFFICULTY_PRESETS,
  ILE_PREGAME_PRESETS,
  ILE_PREGAME_TABS,
  applyIleLearnPreset,
  applyIlePregameDifficultyPreset,
  applyIlePregamePreset,
  clampIlePregameDifficulty,
  clampIlePregameKnobs,
  ileMapTypeSessionExplanation,
  ileLearnMatchingPresetId,
  ilePregameMatchingDifficultyPresetId,
  ilePregameMatchingPresetId,
  ILE_START_TIP_IDS,
  ILE_START_TIP_INTERVAL_MS,
  ILE_START_TIP_LABEL_KEYS,
  nextIleStartTipIndex,
  shuffleIleStartTipIds,
} from "@/lib/ile-pregame-settings";
import {
  ileTurnInsightSlotCount,
  remainingIleTurnInsightSlots,
  ILE_TURN_INSIGHT_SLOT_MAX,
} from "@/lib/ile-turn-insights";
import {
  decideIleGatherResources,
  ILE_GATHER_MAX_PER_SESSION,
} from "@/lib/ile-gather-resources";
import {
  decideIleWorkStart,
  ilePowWorkStartCost,
  ILE_POW_EXPENSE_DEFAULT,
  ILE_WORK_PARALLEL_DISABLED_WARNING,
} from "@/lib/ile-pow-spend";
import { ileCircularMenuDisabledActionIds } from "@/lib/block-circular-menu";
import {
  capIleSessionChapters,
  clampIleSessionChapterCount,
  clampIleSessionInsightGoal,
  ileInsightGoalBlocksWork,
  ileChaptersMarkedDoneForInsightGoal,
} from "@/lib/ile-canvas-session";
import { aestheticPackageVibe } from "@/lib/aesthetics";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-9c55d331956d/implementer";

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body);
}

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

function toolArtifacts(n: number) {
  return Array.from({ length: n }, () => ({ type: "tool" as const }));
}

describe("applyIlePregamePreset (shipped knobs)", () => {
  it("applies each named preset and keeps leftover slots/costs on the live helpers", () => {
    expect(ILE_PREGAME_PRESETS.map((row) => row.id)).toEqual([
      "skirmish",
      "campaign",
      "blitz",
    ]);

    const skirmish = applyIlePregamePreset("skirmish");
    expect(skirmish.powExpense).toBe(ILE_POW_EXPENSE_DEFAULT);
    expect(skirmish.insightSlotMax).toBe(ILE_TURN_INSIGHT_SLOT_MAX);
    expect(skirmish.gatherMaxPerSession).toBe(ILE_GATHER_MAX_PER_SESSION);
    expect(skirmish.chapterCount).toBe(1);
    expect(skirmish).not.toHaveProperty("mapType");
    expect(ilePregameMatchingPresetId(skirmish)).toBe("skirmish");
    const liveExpense: number = ILE_POW_EXPENSE_DEFAULT;
    expect(
      ilePregameMatchingPresetId({
        powExpense: liveExpense,
        insightSlotMax: ILE_TURN_INSIGHT_SLOT_MAX,
        gatherMaxPerSession: ILE_GATHER_MAX_PER_SESSION,
        chapterCount: 1,
      }),
    ).toBe("skirmish");
    expect(ileTurnInsightSlotCount(8, skirmish.insightSlotMax)).toBe(3);
    expect(ilePowWorkStartCost(skirmish.powExpense)).toBe(3);

    const campaign = applyIlePregamePreset("campaign");
    expect(campaign.powExpense).toBe(5);
    expect(campaign.insightSlotMax).toBe(5);
    expect(campaign.gatherMaxPerSession).toBe(2);
    expect(campaign.chapterCount).toBe(3);
    expect(campaign).not.toHaveProperty("mapType");
    expect(ileTurnInsightSlotCount(8, campaign.insightSlotMax)).toBe(5);
    expect(ilePowWorkStartCost(campaign.powExpense)).toBe(8);
    expect(
      remainingIleTurnInsightSlots({
        unusedPow: 8,
        craftedCount: 1,
        slotMax: campaign.insightSlotMax,
      }),
    ).toBe(4);
    expect(
      decideIleGatherResources({
        artifacts: toolArtifacts(8),
        gatherCount: campaign.gatherMaxPerSession,
        now: 9_999_999,
        maxPerSession: campaign.gatherMaxPerSession,
        expense: 1,
      }).allowed,
    ).toBe(false);
    expect(
      decideIleGatherResources({
        artifacts: toolArtifacts(8),
        gatherCount: campaign.gatherMaxPerSession - 1,
        now: 9_999_999,
        maxPerSession: campaign.gatherMaxPerSession,
        expense: 1,
      }).allowed,
    ).toBe(true);

    const blitz = applyIlePregamePreset("blitz");
    expect(blitz.powExpense).toBe(1);
    expect(blitz.insightSlotMax).toBe(1);
    expect(blitz.gatherMaxPerSession).toBe(8);
    expect(blitz.chapterCount).toBe(5);
    expect(blitz).not.toHaveProperty("mapType");
    expect(ileTurnInsightSlotCount(8, blitz.insightSlotMax)).toBe(1);
    expect(ilePowWorkStartCost(blitz.powExpense)).toBe(1);
    expect(
      decideIleGatherResources({
        artifacts: toolArtifacts(8),
        gatherCount: 4,
        now: 9_999_999,
        expense: 1,
      }).allowed,
    ).toBe(false);
    expect(
      decideIleGatherResources({
        artifacts: toolArtifacts(8),
        gatherCount: 4,
        now: 9_999_999,
        maxPerSession: blitz.gatherMaxPerSession,
        expense: 1,
      }).allowed,
    ).toBe(true);

    const resume = applyIlePregamePreset("blitz");
    expect(resume.chapterCount).toBe(5);
    expect(resume.powExpense).toBe(1);
    expect(clampIleSessionChapterCount(9)).toBe(5);
    expect(clampIleSessionChapterCount(0)).toBe(1);
    expect(clampIleSessionChapterCount(3)).toBe(3);
    expect(clampIleSessionChapterCount("22")).toBe(5);
    for (const preset of ILE_PREGAME_PRESETS) {
      const knobs = applyIlePregamePreset(preset.id);
      expect(knobs.chapterCount).toBeGreaterThanOrEqual(1);
      expect(knobs.chapterCount).toBeLessThanOrEqual(5);
      expect(JSON.stringify(knobs)).not.toMatch(/islands|ladder|random_|hub|spiral|ring|tracks/);
    }
    const capped = capIleSessionChapters(
      Array.from({ length: 12 }, (_, index) => ({ id: `c${index}` })),
      3,
    );
    expect(capped.map((row) => row.id)).toEqual(["c0", "c1", "c2"]);
    expect(capIleSessionChapters(capped, 22)).toHaveLength(3);
    const goal = clampIleSessionInsightGoal(9);
    expect(goal).toBe(5);
    expect(clampIleSessionInsightGoal(2)).toBe(2);
    expect(ileInsightGoalBlocksWork(0, goal)).toBe(false);
    expect(ileChaptersMarkedDoneForInsightGoal()).toEqual([]);

    const tweaked = clampIlePregameKnobs({
      ...skirmish,
      insightSlotMax: 5,
    });
    expect(ilePregameMatchingPresetId(tweaked)).toBeNull();
    expect(ileTurnInsightSlotCount(4, tweaked.insightSlotMax)).toBe(4);
    expect(ileTurnInsightSlotCount(8, tweaked.insightSlotMax)).toBe(5);

    const easy = clampIlePregameDifficulty();
    expect(easy.allowThoughtsPoolInsights).toBe(true);
    expect(easy.allowParallelWork).toBe(true);
    expect(easy.allowGatherResources).toBe(true);
    const hard = clampIlePregameDifficulty({
      allowThoughtsPoolInsights: false,
      allowParallelWork: false,
      allowGatherResources: false,
    });
    expect(hard.allowThoughtsPoolInsights).toBe(false);
    const first = decideIleWorkStart({
      chapterId: "ch-2",
      openWorkIds: ["ch-1"],
      available: { tool: 8, screen: 0, video: 0, eeg: 0 },
      expense: 1,
      allowParallelWork: false,
    });
    expect(first.allowed).toBe(false);
    expect(first.reason).toBe("parallel_disabled");
    expect(first.warning).toBe(ILE_WORK_PARALLEL_DISABLED_WARNING);
    expect(
      decideIleGatherResources({
        artifacts: toolArtifacts(8),
        gatherCount: 0,
        now: 9_999_999,
        expense: 1,
        allowGatherResources: false,
      }).allowed,
    ).toBe(false);
    expect(
      ileCircularMenuDisabledActionIds({ allowGatherResources: false }).has(
        "gather_resources",
      ),
    ).toBe(true);

    expect(ILE_PREGAME_DIFFICULTY_PRESETS.map((row) => row.id)).toEqual([
      "casual",
      "veteran",
      "ironman",
    ]);
    const casual = applyIlePregameDifficultyPreset("casual");
    expect(casual.allowThoughtsPoolInsights).toBe(true);
    expect(casual.minInsightsPerChapter).toBe(1);
    expect(casual.canvasTimerSeconds).toBe(60 * 60);
    expect(ilePregameMatchingDifficultyPresetId(casual)).toBe("casual");
    const veteran = applyIlePregameDifficultyPreset("veteran");
    expect(veteran.allowThoughtsPoolInsights).toBe(false);
    expect(veteran.allowParallelWork).toBe(true);
    expect(veteran.allowGatherResources).toBe(true);
    expect(veteran.canvasTimerSeconds).toBe(30 * 60);
    const ironman = applyIlePregameDifficultyPreset("ironman");
    expect(ironman).toEqual({
      allowThoughtsPoolInsights: false,
      allowParallelWork: false,
      allowGatherResources: false,
      minInsightsPerChapter: 2,
      canvasTimerSeconds: 15 * 60,
      silenceLockMinutes: 1,
    });
    expect(ilePregameMatchingDifficultyPresetId(ironman)).toBe("ironman");
    expect(
      ilePregameMatchingDifficultyPresetId({
        allowThoughtsPoolInsights: false,
        allowParallelWork: false,
        allowGatherResources: true,
      }),
    ).toBeNull();

    const islands = ileMapTypeSessionExplanation({ id: "islands" });
    expect(islands.shape.length).toBeGreaterThan(20);
    expect(islands.useWhen.length).toBeGreaterThan(8);
    expect(islands.playRule.length).toBeGreaterThan(8);
  });
});

describe("Learn research presets", () => {
  it("sets chapters, insight goal, silence, and work expense", () => {
    expect(ILE_LEARN_PRESETS.map((row) => row.id)).toEqual(["survey", "study", "thesis"]);

    const survey = applyIleLearnPreset("survey");
    expect(survey).toEqual({
      chapterCount: 1,
      minInsightsPerChapter: 1,
      silenceLockMinutes: 4,
      powExpense: 1,
    });
    expect(ileLearnMatchingPresetId(survey)).toBe("survey");

    const study = applyIleLearnPreset("study");
    expect(study).toEqual({
      chapterCount: 3,
      minInsightsPerChapter: 3,
      silenceLockMinutes: 2,
      powExpense: 3,
    });
    expect(ileLearnMatchingPresetId(study)).toBe("study");

    const thesis = applyIleLearnPreset("thesis");
    expect(thesis).toEqual({
      chapterCount: 5,
      minInsightsPerChapter: 5,
      silenceLockMinutes: 1,
      powExpense: 5,
    });
    expect(ileLearnMatchingPresetId(thesis)).toBe("thesis");
    expect(ileLearnMatchingPresetId({ ...thesis, silenceLockMinutes: 2 })).toBeNull();
    expect(applyIleLearnPreset("unknown").chapterCount).toBe(1);

    const welcome = read("components/session-view/session-welcome-modal.tsx");
    const en = JSON.parse(read("messages/en.json")) as { session: Record<string, string> };
    expect(welcome).toContain("data-ile-learn-presets");
    expect(welcome).toContain("data-ile-learn-preset={preset.id}");
    expect(welcome).toContain("applyIleLearnPreset");
    expect(welcome).toContain("onChapterCountChange?.(knobs.chapterCount)");
    expect(welcome).toContain("onMinInsightsPerChapterChange?.(knobs.minInsightsPerChapter)");
    expect(welcome).toContain("onSilenceLockMinutesChange?.(knobs.silenceLockMinutes)");
    expect(welcome).toContain("onPowExpenseChange?.(knobs.powExpense)");
    expect(welcome).not.toContain("data-ile-pregame-preset");
    expect(en.session.learnPresetSurvey).toBe("Survey");
    expect(en.session.learnPresetStudy).toBe("Study");
    expect(en.session.learnPresetThesis).toBe("Thesis");
    expect(
      `${en.session.learnPresetSurveyDesc} ${en.session.learnPresetStudyDesc} ${en.session.learnPresetThesisDesc}`,
    ).not.toMatch(/\bmap\b|\bboard\b/i);
  });
});

describe("TAP Learning pre-game settings surface", () => {
  it("uses Welcome to your learning session, Start Session, presets, extra sliders, and full map copy", () => {
    const welcome = read("components/session-view/session-welcome-modal.tsx");
    const picker = read("components/InitialChaptersPicker.tsx");
    const view = readSessionViewSurface();
    const en = JSON.parse(read("messages/en.json")) as {
      session: Record<string, string>;
    };

    expect(en.session.welcomeTitle).toBe("Welcome to your learning session");
    expect(en.session.confirmSettings).toBe("Start Session");
    expect(en.session.welcomeTitle).not.toBe("Welcome to your block");
    expect(en.session.confirmSettings).not.toBe("Confirm Settings");
    expect(en.session.pregamePresetSkirmish).toBe("Skirmish");
    expect(en.session.pregamePresetCampaign).toBe("Campaign");
    expect(en.session.pregamePresetBlitz).toBe("Blitz");
    expect(en.session.insightSlotMax).toBeTruthy();
    expect(en.session.gatherMax).toBeTruthy();
    expect(en.session.mapTypeUseWhen).toBe("Use when");
    expect(en.session.mapTypePlayRule).toBe("Play rule");

    expect(welcome).toContain("session.welcomeTitle");
    expect(welcome).toContain("session.confirmSettings");
    expect(welcome).toContain("TapBriefingConfig");
    expect(welcome).toContain("showDurationPicker={false}");
    expect(welcome).toContain("TapAestheticSection");
    expect(en.session.pregamePresets).toBe("Presets");
    expect(welcome).not.toContain("data-ile-pregame-preset");
    expect(welcome).not.toContain("data-ile-pregame-presets-band");
    expect(welcome).not.toContain("data-ile-insight-slot-slider");
    expect(welcome).not.toContain("data-ile-gather-max-slider");
    expect(welcome).toContain("data-ile-session-chapter-count");
    expect(welcome).toContain("data-ile-session-insight-goal");
    expect(welcome).not.toContain("InitialChaptersPicker");
    expect(welcome).not.toContain("IleContinueMapPreview");
    expect(welcome).not.toContain("data-ile-pregame-map");
    expect(welcome).not.toContain("data-ile-pregame-difficulty-preset");
    expect(welcome).not.toContain("applyIlePregameDifficultyPreset");
    expect(welcome).not.toContain("applyIlePregamePreset");
    expect(welcome).not.toContain("data-ile-pregame-tabs");
    expect(welcome).not.toContain("data-ile-pregame-tab=");
    expect(welcome).not.toContain("ile-pregame-panel-economy");
    expect(welcome).not.toContain("ile-pregame-panel-map");
    expect(welcome).not.toContain("ile-pregame-panel-difficulty");
    expect(welcome).not.toContain("ile-pregame-panel-other");
    expect(welcome).not.toContain("data-ile-pregame-difficulty-toggle");
    expect(welcome).not.toContain("data-ile-browser-inference");
    expect(welcome).toContain("data-ile-min-insights-slider");
    expect(welcome).not.toContain("data-ile-canvas-timer-slider");
    expect(en.session.minInsightsPerChapter).toBeTruthy();
    expect(en.session.canvasTimer).toBeTruthy();
    expect(en.session.canvasTimerCheap).toBe("10 min");
    expect(en.session.canvasTimerExpensive).toBe("60 min");
    expect(welcome).not.toContain("ILE_CANVAS_TIMER_SECONDS_STEP");
    expect(welcome).not.toContain("ILE_CANVAS_TIMER_SECONDS_MIN");
    expect(welcome).not.toContain("ILE_CANVAS_TIMER_SECONDS_CEILING");
    expect(welcome).not.toContain("ILE_PREGAME_TABS");
    expect(ILE_PREGAME_TABS.map((tab) => tab.id)).toEqual([
      "economy",
      "difficulty",
      "other",
    ]);
    expect(en.session.pregameTabEconomy).toBe("Chapters");
    expect(en.session.chapterCount).toBe("Chapters");
    expect(en.session.minInsightsPerChapter).toBe("Insight goal");
    expect(`${en.session.welcomeMessage} ${en.session.chapterCountDesc} ${en.session.minInsightsPerChapterDesc} ${en.session.pregamePresetSkirmishDesc}`).not.toMatch(/\bmap\b|\bboard\b/i);
    expect(en.session.pregameTabDifficulty).toBe("Difficulty");
    expect(en.session.pregameTabOther).toBe("Other Settings");
    expect(en.session.difficultyPresetCasual).toBe("Casual");
    expect(en.session.difficultyPresetVeteran).toBe("Veteran");
    expect(en.session.difficultyPresetIronman).toBe("Ironman");
    expect(view).toContain("allowThoughtsPoolInsights={allowThoughtsPoolInsights}");
    expect(view).toContain("allowParallelWork");
    expect(view).toContain("allowGatherResources");
    const craft = read("components/session-view/ile-turn-insight-craft.tsx");
    expect(craft).toContain("data-ile-end-turn-screen");
    expect(craft).not.toContain("allowThoughtsPoolInsights");
    expect(welcome).toContain("overflow-hidden");
    const footerAt = welcome.indexOf("data-ile-confirm-settings-footer");
    const confirmAt = welcome.indexOf("data-ile-confirm-settings", footerAt + 10);
    const confirmBtn = welcome.slice(confirmAt, confirmAt + 1200);
    expect(confirmBtn).toContain("inline-flex w-full");
    expect(welcome).toContain("mt-auto");
    expect(welcome).toContain("data-ile-back-to-workspace");
    expect(welcome).toContain("data-ile-start-loading-page");
    expect(welcome).toContain("IleStartLoading");
    expect(welcome).toContain("isPreparing");
    const startLoad = read("components/session-view/ile-start-loading.tsx");
    expect(startLoad).toContain("data-ile-start-loading");
    expect(startLoad).toContain("data-ile-start-tips");
    expect(startLoad).toContain("data-ile-start-tip-index");
    expect(startLoad).toContain("data-ile-start-tip-mark");
    expect(startLoad).toContain("SessionConsoleMarks");
    expect(startLoad).toContain("LoadingStatusMessage");
    const pageLoad = read("components/session-view/session-page-loading.tsx");
    expect(pageLoad).toContain("data-console-frame");
    expect(pageLoad).toContain("SessionConsoleScan");
    expect(pageLoad).toContain("SessionConsoleMarks");
    expect(startLoad).toContain("shuffleIleStartTipIds");
    expect(startLoad).toContain("nextIleStartTipIndex");
    expect(startLoad).toContain("ILE_START_TIP_INTERVAL_MS");
    expect(en.session.startLoading).toBe("Starting session");
    expect(en.session.startTipsTitle).toBe("Tips & Tricks");
    expect(ILE_START_TIP_IDS).toHaveLength(5);
    expect(ILE_START_TIP_IDS).not.toContain("end-turn");
    expect(ILE_START_TIP_IDS).not.toContain("map-pan");
    expect(shuffleIleStartTipIds(["send-enter", "craft-insight"], () => 0)).toEqual([
      "craft-insight",
      "send-enter",
    ]);
    expect(nextIleStartTipIndex(4, 5)).toBe(0);
    expect(nextIleStartTipIndex(0, 5)).toBe(1);
    expect(ILE_START_TIP_INTERVAL_MS).toBe(12000);
    expect(en.session.startTipCraftInsight).toMatch(/canvas/i);
    expect(en.session.startTipCraftInsight).not.toMatch(/\bboard\b|\bend turn\b/i);
    expect(en.session.startTipSendEnter).not.toMatch(/unsys/i);
    expect(en.session[ILE_START_TIP_LABEL_KEYS["craft-insight"].replace("session.", "")]).toBeTruthy();
    const continuePreview = read("components/session-view/ile-continue-map-preview.tsx");
    expect(continuePreview).toContain("animate-spin");
    expect(continuePreview).toContain("Checking for existing chapters");
    expect(welcome).toContain('t("session.backToDashboard")');
    expect(en.session.backToDashboard).toBe("Back to Workspace");
    expect(view).toContain("onBackToWorkspace");
    expect(view).toContain("pauseAndGoToDashboard");
    const backAt = welcome.indexOf("data-ile-back-to-workspace");
    expect(backAt).toBeGreaterThan(footerAt);
    expect(backAt).toBeLessThan(confirmAt);
    expect(picker).toContain("data-ile-map-type-use-when");
    expect(welcome).not.toContain("catalogStrip");
    expect(welcome).toContain("data-ile-session-chapter-count");
    expect(welcome).not.toContain("data-ile-pregame-economy-map");
    expect(welcome).toContain("lg:grid-cols-2");
    expect(picker).toContain("line-clamp-3");
    const aestheticUi = read("components/AestheticPicker.tsx");
    const aesAt = welcome.indexOf("<AestheticPicker");
    expect(aesAt).toBeGreaterThan(-1);
    expect(welcome.slice(aesAt, aesAt + 500)).toContain("fillHeight");
    expect(welcome).not.toContain("ile-pregame-panel-other");
    expect(aestheticUi).toContain("data-ile-aesthetic-picker");
    expect(aestheticUi).toContain("data-ile-aesthetic-vibe");
    expect(aestheticUi).toContain("aestheticPackageVibe");
    expect(aestheticUi).toContain("auto-rows-fr");
    expect(aestheticPackageVibe("architecture")).toMatch(/teal|palace|forest/i);
    expect(aestheticPackageVibe("Greco-futurism")).toMatch(/marble|colonnade/i);
    expect(aestheticPackageVibe("galactic-stoneworks")).toMatch(/forest|window/i);
    expect(aestheticPackageVibe("lunar")).toMatch(/lunar|Earth/i);
    expect(aestheticPackageVibe("mars")).toMatch(/lattice|garden/i);
    expect(aestheticPackageVibe("piotr-binkowski")).toMatch(/colossal|temple/i);
    expect(aestheticPackageVibe("brand-new-pack")).toMatch(/Brand New Pack/);
    expect(view).toContain("insightSlotMax={insightSlotMax}");
    expect(view).toContain("maxPerSession: gatherMaxPerSession");
    const hook = read("components/session-view/use-ile-gather-resources.ts");
    const api = read("app/api/ile/gather-resources/route.ts");
    expect(hook).toContain("maxPerSession: input.maxPerSession");
    expect(hook).toContain("/api/ile/gather-resources");
    expect(api).toContain("maxPerSession: body.maxPerSession");
    expect(api).toContain("decideIleGatherResources");
    const fetchAt = hook.indexOf('fetch("/api/ile/gather-resources"');
    expect(fetchAt).toBeGreaterThan(-1);
    expect(hook.slice(fetchAt, fetchAt + 900)).toContain(
      "maxPerSession: input.maxPerSession",
    );
    const decideAt = api.indexOf("decideIleGatherResources({");
    expect(decideAt).toBeGreaterThan(-1);
    expect(api.slice(decideAt, decideAt + 700)).toContain(
      "maxPerSession: body.maxPerSession",
    );

    writeScratch(
      "ile-pregame-settings-surface.txt",
      [
        `welcomeTitle=${en.session.welcomeTitle}`,
        `startSession=${en.session.confirmSettings}`,
        `presets=${ILE_PREGAME_PRESETS.map((row) => row.id).join(",")}`,
        `presetLabels=${[en.session.pregamePresetSkirmish, en.session.pregamePresetCampaign, en.session.pregamePresetBlitz].join(",")}`,
        `sliders=powExpense,insightSlotMax,gatherMax`,
        `mapExplain=shape,useWhen,playRule`,
        `skirmish=${JSON.stringify(applyIlePregamePreset("skirmish"))}`,
        `campaign=${JSON.stringify(applyIlePregamePreset("campaign"))}`,
        `blitz=${JSON.stringify(applyIlePregamePreset("blitz"))}`,
        `tabs=${ILE_PREGAME_TABS.map((tab) => tab.id).join(",")}`,
        `difficulty=${JSON.stringify(clampIlePregameDifficulty({ allowThoughtsPoolInsights: false }))}`,
        `cta=sidebar-mt-auto`,
        `difficultyPresets=${ILE_PREGAME_DIFFICULTY_PRESETS.map((row) => row.id).join(",")}`,
        `gatherWire=maxPerSession:input.maxPerSession+body.maxPerSession`,
        `blitzCap8allowsCount4=${decideIleGatherResources({
          artifacts: toolArtifacts(8),
          gatherCount: 4,
          now: 9_999_999,
          maxPerSession: applyIlePregamePreset("blitz").gatherMaxPerSession,
          expense: 1,
        }).allowed}`,
      ].join("\n") + "\n",
    );
  });
});
