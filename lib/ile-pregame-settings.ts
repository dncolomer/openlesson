/**
 * TAP Learning pre-game settings: named presets and slider knobs applied before
 * Start Session. Pure — tests apply a preset and read the resulting knobs.
 */
import {
  clampIleSessionChapterCount,
  clampIleSessionInsightGoal,
} from "@/lib/ile-canvas-session";
import {
  ILE_GATHER_MAX_PER_SESSION,
  clampIleGatherMaxPerSession,
} from "@/lib/ile-gather-resources";
import {
  ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
  ILE_TURN_INSIGHT_SLOT_MAX,
  clampIleTurnInsightSlotMax,
} from "@/lib/ile-turn-insights";
import {
  ILE_CANVAS_TIMER_SECONDS_CEILING,
  ILE_CANVAS_TIMER_SECONDS_DEFAULT,
  clampIleCanvasTimerSeconds,
} from "@/lib/ile-work-canvas";
import {
  ILE_POW_EXPENSE_DEFAULT,
  clampIlePowExpense,
  type IlePowExpenseLevel,
} from "@/lib/ile-pow-spend";
import { MAP_TYPE_LIBRARY_BY_ID } from "@/lib/map-type-library";
import {
  ILE_SILENCE_LOCK_MINUTES_DEFAULT,
  clampIleSilenceLockMinutes,
} from "@/lib/practice-voice-challenge";

export const ILE_PREGAME_PRESET_IDS = ["skirmish", "campaign", "blitz"] as const;
export type IlePregamePresetId = (typeof ILE_PREGAME_PRESET_IDS)[number];

/**
 * Knobs that still change a live Learn session and stay on the TAP settings card.
 * Learn has no session-length clock, so the TAP duration grid is hidden.
 * The work-canvas timer, gather appetite, and the parallel-work, gather, and
 * browser-inference toggles are not learner settings.
 */
export const ILE_LIVE_SETTINGS_KNOBS = [
  { id: "chapterCount", attribute: "data-ile-session-chapter-count" },
  { id: "insightGoal", attribute: "data-ile-session-insight-goal" },
  { id: "silenceLock", attribute: "data-ile-silence-lock-minutes" },
  { id: "spokenLanguage", attribute: "data-tap-briefing-config" },
  { id: "powExpense", attribute: "data-ile-pow-expense-slider" },
] as const;

/**
 * Research presets for the Learn settings card. They set only the knobs
 * that still change the session. Spoken language and look stay as chosen.
 */
export const ILE_LEARN_PRESET_IDS = ["survey", "study", "thesis"] as const;
export type IleLearnPresetId = (typeof ILE_LEARN_PRESET_IDS)[number];

export type IleLearnPresetKnobs = {
  chapterCount: number;
  minInsightsPerChapter: number;
  silenceLockMinutes: number;
  powExpense: IlePowExpenseLevel;
};

export type IleLearnPreset = {
  id: IleLearnPresetId;
  labelKey: string;
  descKey: string;
  knobs: IleLearnPresetKnobs;
};

export const ILE_LEARN_PRESETS: readonly IleLearnPreset[] = [
  {
    id: "survey",
    labelKey: "session.learnPresetSurvey",
    descKey: "session.learnPresetSurveyDesc",
    knobs: {
      chapterCount: 1,
      minInsightsPerChapter: 1,
      silenceLockMinutes: 4,
      powExpense: 1,
    },
  },
  {
    id: "study",
    labelKey: "session.learnPresetStudy",
    descKey: "session.learnPresetStudyDesc",
    knobs: {
      chapterCount: 3,
      minInsightsPerChapter: 3,
      silenceLockMinutes: ILE_SILENCE_LOCK_MINUTES_DEFAULT,
      powExpense: ILE_POW_EXPENSE_DEFAULT,
    },
  },
  {
    id: "thesis",
    labelKey: "session.learnPresetThesis",
    descKey: "session.learnPresetThesisDesc",
    knobs: {
      chapterCount: 5,
      minInsightsPerChapter: 5,
      silenceLockMinutes: 1,
      powExpense: 5,
    },
  },
];

export function applyIleLearnPreset(presetId: unknown): IleLearnPresetKnobs {
  const preset =
    ILE_LEARN_PRESETS.find((row) => row.id === presetId) ?? ILE_LEARN_PRESETS[0];
  return {
    chapterCount: clampIleSessionChapterCount(preset.knobs.chapterCount),
    minInsightsPerChapter: clampIleSessionInsightGoal(preset.knobs.minInsightsPerChapter),
    silenceLockMinutes: clampIleSilenceLockMinutes(preset.knobs.silenceLockMinutes),
    powExpense: clampIlePowExpense(preset.knobs.powExpense),
  };
}

export function ileLearnMatchingPresetId(knobs?: {
  chapterCount?: unknown;
  minInsightsPerChapter?: unknown;
  silenceLockMinutes?: unknown;
  powExpense?: unknown;
} | null): IleLearnPresetId | null {
  const clamped: IleLearnPresetKnobs = {
    chapterCount: clampIleSessionChapterCount(knobs?.chapterCount),
    minInsightsPerChapter: clampIleSessionInsightGoal(knobs?.minInsightsPerChapter),
    silenceLockMinutes: clampIleSilenceLockMinutes(knobs?.silenceLockMinutes),
    powExpense: clampIlePowExpense(knobs?.powExpense),
  };
  for (const preset of ILE_LEARN_PRESETS) {
    const want = applyIleLearnPreset(preset.id);
    if (
      want.chapterCount === clamped.chapterCount &&
      want.minInsightsPerChapter === clamped.minInsightsPerChapter &&
      want.silenceLockMinutes === clamped.silenceLockMinutes &&
      want.powExpense === clamped.powExpense
    ) {
      return preset.id;
    }
  }
  return null;
}

export const ILE_PREGAME_TAB_IDS = ["economy", "difficulty", "other"] as const;
export type IlePregameTabId = (typeof ILE_PREGAME_TAB_IDS)[number];

export const ILE_PREGAME_TABS: readonly { id: IlePregameTabId; labelKey: string }[] = [
  { id: "economy", labelKey: "session.pregameTabEconomy" },
  { id: "difficulty", labelKey: "session.pregameTabDifficulty" },
  { id: "other", labelKey: "session.pregameTabOther" },
];

export type IlePregameDifficulty = {
  allowThoughtsPoolInsights: boolean;
  allowParallelWork: boolean;
  allowGatherResources: boolean;
  minInsightsPerChapter: number;
  canvasTimerSeconds: number;
  /** Positive minutes of silence before a TAP Learning rest lock. Cannot be turned off. */
  silenceLockMinutes: number;
};

export function clampIlePregameDifficulty(
  input?: Partial<IlePregameDifficulty> | null,
): IlePregameDifficulty {
  return {
    allowThoughtsPoolInsights: input?.allowThoughtsPoolInsights !== false,
    allowParallelWork: input?.allowParallelWork !== false,
    allowGatherResources: input?.allowGatherResources !== false,
    minInsightsPerChapter: clampIleSessionInsightGoal(
      input?.minInsightsPerChapter ?? ILE_MIN_INSIGHTS_PER_CHAPTER_DEFAULT,
    ),
    canvasTimerSeconds: clampIleCanvasTimerSeconds(
      input?.canvasTimerSeconds ?? ILE_CANVAS_TIMER_SECONDS_DEFAULT,
    ),
    silenceLockMinutes: clampIleSilenceLockMinutes(
      input?.silenceLockMinutes ?? ILE_SILENCE_LOCK_MINUTES_DEFAULT,
    ),
  };
}

export const ILE_PREGAME_DIFFICULTY_PRESET_IDS = [
  "casual",
  "veteran",
  "ironman",
] as const;
export type IlePregameDifficultyPresetId =
  (typeof ILE_PREGAME_DIFFICULTY_PRESET_IDS)[number];

export type IlePregameDifficultyPreset = {
  id: IlePregameDifficultyPresetId;
  labelKey: string;
  descKey: string;
  difficulty: IlePregameDifficulty;
};

export const ILE_PREGAME_DIFFICULTY_PRESETS: readonly IlePregameDifficultyPreset[] =
  [
    {
      id: "casual",
      labelKey: "session.difficultyPresetCasual",
      descKey: "session.difficultyPresetCasualDesc",
      difficulty: {
        allowThoughtsPoolInsights: true,
        allowParallelWork: true,
        allowGatherResources: true,
        minInsightsPerChapter: 1,
        canvasTimerSeconds: ILE_CANVAS_TIMER_SECONDS_CEILING,
        silenceLockMinutes: 4,
      },
    },
    {
      id: "veteran",
      labelKey: "session.difficultyPresetVeteran",
      descKey: "session.difficultyPresetVeteranDesc",
      difficulty: {
        allowThoughtsPoolInsights: false,
        allowParallelWork: true,
        allowGatherResources: true,
        minInsightsPerChapter: 1,
        canvasTimerSeconds: 30 * 60,
        silenceLockMinutes: 2,
      },
    },
    {
      id: "ironman",
      labelKey: "session.difficultyPresetIronman",
      descKey: "session.difficultyPresetIronmanDesc",
      difficulty: {
        allowThoughtsPoolInsights: false,
        allowParallelWork: false,
        allowGatherResources: false,
        minInsightsPerChapter: 2,
        canvasTimerSeconds: ILE_CANVAS_TIMER_SECONDS_DEFAULT,
        silenceLockMinutes: 1,
      },
    },
  ];

export function applyIlePregameDifficultyPreset(
  presetId: unknown,
): IlePregameDifficulty {
  const preset =
    ILE_PREGAME_DIFFICULTY_PRESETS.find((row) => row.id === presetId) ??
    ILE_PREGAME_DIFFICULTY_PRESETS[0];
  return clampIlePregameDifficulty(preset.difficulty);
}

export function ilePregameMatchingDifficultyPresetId(
  difficulty: Partial<IlePregameDifficulty> | IlePregameDifficulty,
): IlePregameDifficultyPresetId | null {
  const clamped = clampIlePregameDifficulty(difficulty);
  for (const preset of ILE_PREGAME_DIFFICULTY_PRESETS) {
    const want = clampIlePregameDifficulty(preset.difficulty);
    if (
      want.allowThoughtsPoolInsights === clamped.allowThoughtsPoolInsights &&
      want.allowParallelWork === clamped.allowParallelWork &&
      want.allowGatherResources === clamped.allowGatherResources &&
      want.minInsightsPerChapter === clamped.minInsightsPerChapter &&
      want.canvasTimerSeconds === clamped.canvasTimerSeconds &&
      want.silenceLockMinutes === clamped.silenceLockMinutes
    ) {
      return preset.id;
    }
  }
  return null;
}

export function isIlePregameTabId(value: unknown): value is IlePregameTabId {
  return (
    typeof value === "string" &&
    (ILE_PREGAME_TAB_IDS as readonly string[]).includes(value)
  );
}

export type IlePregameKnobs = {
  powExpense: IlePowExpenseLevel;
  insightSlotMax: number;
  gatherMaxPerSession: number;
  /** Chapters this session makes available. Never a map type. */
  chapterCount: number;
};

export type IlePregamePreset = {
  id: IlePregamePresetId;
  labelKey: string;
  descKey: string;
  knobs: IlePregameKnobs;
};

export const ILE_PREGAME_PRESETS: readonly IlePregamePreset[] = [
  {
    id: "skirmish",
    labelKey: "session.pregamePresetSkirmish",
    descKey: "session.pregamePresetSkirmishDesc",
    knobs: {
      powExpense: ILE_POW_EXPENSE_DEFAULT,
      insightSlotMax: ILE_TURN_INSIGHT_SLOT_MAX,
      gatherMaxPerSession: ILE_GATHER_MAX_PER_SESSION,
      chapterCount: 1,
    },
  },
  {
    id: "campaign",
    labelKey: "session.pregamePresetCampaign",
    descKey: "session.pregamePresetCampaignDesc",
    knobs: {
      powExpense: 5,
      insightSlotMax: 5,
      gatherMaxPerSession: 2,
      chapterCount: 3,
    },
  },
  {
    id: "blitz",
    labelKey: "session.pregamePresetBlitz",
    descKey: "session.pregamePresetBlitzDesc",
    knobs: {
      powExpense: 1,
      insightSlotMax: 1,
      gatherMaxPerSession: 8,
      chapterCount: 5,
    },
  },
];

export function isIlePregamePresetId(value: unknown): value is IlePregamePresetId {
  return (
    typeof value === "string" &&
    (ILE_PREGAME_PRESET_IDS as readonly string[]).includes(value)
  );
}

export function clampIlePregameKnobs(input: {
  powExpense?: unknown;
  insightSlotMax?: unknown;
  gatherMaxPerSession?: unknown;
  chapterCount?: unknown;
}): IlePregameKnobs {
  return {
    powExpense: clampIlePowExpense(input.powExpense),
    insightSlotMax: clampIleTurnInsightSlotMax(input.insightSlotMax),
    gatherMaxPerSession: clampIleGatherMaxPerSession(input.gatherMaxPerSession),
    chapterCount: clampIleSessionChapterCount(input.chapterCount),
  };
}

/** Apply a named setup. Presets set a chapter count and never a map type. */
export function applyIlePregamePreset(presetId: unknown): IlePregameKnobs {
  const preset =
    ILE_PREGAME_PRESETS.find((row) => row.id === presetId) ?? ILE_PREGAME_PRESETS[0];
  return clampIlePregameKnobs(preset.knobs);
}

export function ilePregameMatchingPresetId(
  knobs: {
    powExpense?: unknown;
    insightSlotMax?: unknown;
    gatherMaxPerSession?: unknown;
    chapterCount?: unknown;
  },
): IlePregamePresetId | null {
  const clamped = clampIlePregameKnobs(knobs);
  for (const preset of ILE_PREGAME_PRESETS) {
    const want = clampIlePregameKnobs(preset.knobs);
    if (
      want.powExpense === clamped.powExpense &&
      want.insightSlotMax === clamped.insightSlotMax &&
      want.gatherMaxPerSession === clamped.gatherMaxPerSession &&
      want.chapterCount === clamped.chapterCount
    ) {
      return preset.id;
    }
  }
  return null;
}

export function ileMapTypeSessionExplanation(input: {
  id?: string | null;
  description?: string | null;
  playRule?: string | null;
  useWhen?: string | null;
}): { shape: string; playRule: string; useWhen: string } {
  const id = String(input.id ?? "").trim();
  const lib = id ? MAP_TYPE_LIBRARY_BY_ID[id] : undefined;
  const shape = String(input.description ?? lib?.description ?? "").trim();
  const playRule = String(input.playRule ?? lib?.playRule ?? "").trim();
  const useWhen = String(input.useWhen ?? lib?.useWhen ?? "").trim();
  return { shape, playRule, useWhen };
}

export const ILE_START_TIP_IDS = [
  "send-enter",
  "stash-del",
  "craft-insight",
  "chapters",
  "thought-memory",
] as const;

export type IleStartTipId = (typeof ILE_START_TIP_IDS)[number];

export const ILE_START_TIP_LABEL_KEYS: Record<IleStartTipId, string> = {
  "send-enter": "session.startTipSendEnter",
  "stash-del": "session.startTipStashDel",
  "craft-insight": "session.startTipCraftInsight",
  chapters: "session.startTipChapters",
  "thought-memory": "session.startTipThoughtMemory",
};

export const ILE_START_TIP_INTERVAL_MS = 12000;

export function shuffleIleStartTipIds(
  ids: readonly IleStartTipId[] = ILE_START_TIP_IDS,
  random: () => number = Math.random,
): IleStartTipId[] {
  const next = [...ids];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    const swap = next[i];
    next[i] = next[j] ?? swap;
    next[j] = swap;
  }
  return next;
}

export function nextIleStartTipIndex(index: number, count: number): number {
  if (count <= 0) return 0;
  return (Math.max(0, index) + 1) % count;
}
