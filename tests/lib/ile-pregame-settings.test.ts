/**
 * ILE pre-game settings: named presets, extra sliders, Start Session copy,
 * fuller map-type explanation. Drives shipped helpers (no re-implementation).
 */
import { describe, expect, it } from "vitest";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";
import {
  ILE_PREGAME_DIFFICULTY_PRESETS,
  ILE_PREGAME_PRESETS,
  ILE_PREGAME_TABS,
  applyIlePregameDifficultyPreset,
  applyIlePregamePreset,
  clampIlePregameDifficulty,
  clampIlePregameKnobs,
  ileMapTypeSessionExplanation,
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
import { DEFAULT_INITIAL_CHAPTERS } from "@/lib/initial-chapters";
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
    expect(skirmish.mapType).toBe(DEFAULT_INITIAL_CHAPTERS);
    expect(ilePregameMatchingPresetId(skirmish)).toBe("skirmish");
    const liveExpense: number = ILE_POW_EXPENSE_DEFAULT;
    expect(
      ilePregameMatchingPresetId({
        powExpense: liveExpense,
        insightSlotMax: ILE_TURN_INSIGHT_SLOT_MAX,
        gatherMaxPerSession: ILE_GATHER_MAX_PER_SESSION,
        mapType: DEFAULT_INITIAL_CHAPTERS,
      }),
    ).toBe("skirmish");
    expect(ileTurnInsightSlotCount(8, skirmish.insightSlotMax)).toBe(3);
    expect(ilePowWorkStartCost(skirmish.powExpense)).toBe(3);

    const campaign = applyIlePregamePreset("campaign");
    expect(campaign.powExpense).toBe(5);
    expect(campaign.insightSlotMax).toBe(5);
    expect(campaign.gatherMaxPerSession).toBe(2);
    expect(campaign.mapType).toBe("ladder");
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
    expect(blitz.mapType).toBe("random_dense");
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

    const resume = applyIlePregamePreset("blitz", {
      mapChoosable: false,
      currentMap: "hub",
    });
    expect(resume.mapType).toBe("hub");
    expect(resume.powExpense).toBe(1);

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
    expect(ilePregameMatchingDifficultyPresetId(casual)).toBe("casual");
    const veteran = applyIlePregameDifficultyPreset("veteran");
    expect(veteran.allowThoughtsPoolInsights).toBe(false);
    expect(veteran.allowParallelWork).toBe(true);
    expect(veteran.allowGatherResources).toBe(true);
    const ironman = applyIlePregameDifficultyPreset("ironman");
    expect(ironman).toEqual({
      allowThoughtsPoolInsights: false,
      allowParallelWork: false,
      allowGatherResources: false,
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

describe("ILE pre-game settings surface", () => {
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
    expect(welcome).toContain("data-ile-pregame-preset");
    expect(welcome).toContain("data-ile-pregame-presets-band");
    expect(en.session.pregamePresets).toBe("Presets");
    expect(welcome).toContain("data-ile-insight-slot-slider");
    expect(welcome).toContain("data-ile-gather-max-slider");
    expect(welcome).toContain("data-ile-map-type-explain");
    expect(welcome).toContain("explainFully");
    expect(welcome).toContain("data-ile-pregame-difficulty-preset");
    expect(welcome).toContain("applyIlePregameDifficultyPreset");
    expect(welcome).toContain("applyIlePregamePreset");
    expect(welcome).toContain("data-ile-pregame-tabs");
    expect(welcome).toContain("data-ile-pregame-tab={tab.id}");
    expect(welcome).toContain("ile-pregame-panel-economy");
    expect(welcome).toContain("ile-pregame-panel-map");
    expect(welcome).toContain("ile-pregame-panel-difficulty");
    expect(welcome).toContain("ile-pregame-panel-other");
    expect(welcome).toContain("aria-orientation=\"vertical\"");
    expect(welcome).toContain("data-ile-pregame-difficulty-toggle");
    const toggleAt = welcome.indexOf("data-ile-pregame-difficulty-toggle");
    expect(toggleAt).toBeGreaterThan(-1);
    expect(welcome.slice(welcome.lastIndexOf("<div", toggleAt), toggleAt)).toContain(
      "w-full min-w-0",
    );
    expect(welcome.slice(toggleAt, toggleAt + 500)).toContain("flex w-full items-start");
    expect(welcome).toContain("ILE_PREGAME_TABS");
    expect(ILE_PREGAME_TABS.map((tab) => tab.id)).toEqual([
      "economy",
      "difficulty",
      "other",
    ]);
    expect(en.session.pregameTabEconomy).toBe("Map & Economy");
    expect(en.session.pregameTabDifficulty).toBe("Difficulty");
    expect(en.session.pregameTabOther).toBe("Other Settings");
    expect(en.session.difficultyPresetCasual).toBe("Casual");
    expect(en.session.difficultyPresetVeteran).toBe("Veteran");
    expect(en.session.difficultyPresetIronman).toBe("Ironman");
    expect(view).toContain("allowThoughtsPoolInsights={allowThoughtsPoolInsights}");
    expect(view).toContain("allowParallelWork");
    expect(view).toContain("allowGatherResources");
    const craft = read("components/session-view/ile-turn-insight-craft.tsx");
    expect(craft).toContain("poolEnabled");
    expect(craft).toContain("allowThoughtsPoolInsights");
    const tabsAt = welcome.indexOf("data-ile-pregame-tabs");
    const footerForTabs = welcome.indexOf("data-ile-confirm-settings-footer");
    expect(tabsAt).toBeGreaterThan(-1);
    expect(footerForTabs).toBeGreaterThan(tabsAt);
    expect(welcome).toContain('data-ile-pregame-fit="viewport"');
    expect(welcome).toContain("overflow-hidden");
    const fitAt = welcome.indexOf('data-ile-pregame-fit="viewport"');
    expect(fitAt).toBeGreaterThan(-1);
    expect(welcome.slice(fitAt, fitAt + 220)).toContain("overflow-hidden");
    expect(welcome.slice(fitAt, fitAt + 220)).not.toContain("overflow-y-auto");
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
    expect(startLoad).toContain("LoadingStatusMessage");
    expect(startLoad).toContain("shuffleIleStartTipIds");
    expect(startLoad).toContain("nextIleStartTipIndex");
    expect(startLoad).toContain("ILE_START_TIP_INTERVAL_MS");
    expect(en.session.startLoading).toBe("Starting session");
    expect(en.session.startTipsTitle).toBe("Tips & Tricks");
    expect(ILE_START_TIP_IDS).toHaveLength(8);
    expect(shuffleIleStartTipIds(["send-enter", "end-turn"], () => 0)).toEqual([
      "end-turn",
      "send-enter",
    ]);
    expect(nextIleStartTipIndex(7, 8)).toBe(0);
    expect(nextIleStartTipIndex(0, 8)).toBe(1);
    expect(ILE_START_TIP_INTERVAL_MS).toBeGreaterThanOrEqual(4000);
    expect(en.session[ILE_START_TIP_LABEL_KEYS["end-turn"].replace("session.", "")]).toBeTruthy();
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
    expect(picker).toContain("explainFully");
    expect(picker).toContain("data-ile-map-type-use-when");
    expect(picker).toContain("data-ile-map-type-play-rule");
    expect(picker).toContain("data-ile-map-type-shape");
    expect(picker).toContain("data-ile-map-type-strip");
    expect(picker).toContain("data-ile-map-type-copy");
    expect(picker).toContain("overflow-y-auto");
    expect(picker).toContain("h-0 flex-1");
    expect(picker).toContain("overflow-hidden");
    expect(welcome).toContain("catalogStrip");
    expect(welcome).toContain("fillHeight");
    expect(welcome).toContain("data-ile-pregame-economy-map");
    expect(welcome).toContain("lg:items-start");
    expect(welcome).toContain("justify-start gap-3");
    expect(welcome).not.toContain("justify-evenly");
    expect(welcome).not.toContain("justify-center gap-6");
    expect(welcome).toContain("max-lg:grid-rows-[auto_minmax(0,1fr)]");
    expect(welcome).toContain("lg:grid-rows-1");
    expect(picker).toContain("line-clamp-3");
    const aestheticUi = read("components/AestheticPicker.tsx");
    const aesAt = welcome.indexOf("<AestheticPicker");
    expect(aesAt).toBeGreaterThan(-1);
    expect(welcome.slice(aesAt, aesAt + 500)).toContain("fillHeight");
    expect(welcome).toContain("ile-pregame-panel-other");
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
