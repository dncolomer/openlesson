/**
 * ILE pre-game settings: named presets and slider knobs applied before
 * Start Session. Pure — tests apply a preset and read the resulting knobs.
 */
import { DEFAULT_INITIAL_CHAPTERS } from "@/lib/initial-chapters";
import {
  ILE_GATHER_MAX_PER_SESSION,
  clampIleGatherMaxPerSession,
} from "@/lib/ile-gather-resources";
import {
  ILE_TURN_INSIGHT_SLOT_MAX,
  clampIleTurnInsightSlotMax,
} from "@/lib/ile-turn-insights";
import {
  ILE_POW_EXPENSE_DEFAULT,
  clampIlePowExpense,
  type IlePowExpenseLevel,
} from "@/lib/ile-pow-spend";
import { MAP_TYPE_LIBRARY_BY_ID } from "@/lib/map-type-library";

export const ILE_PREGAME_PRESET_IDS = ["skirmish", "campaign", "blitz"] as const;
export type IlePregamePresetId = (typeof ILE_PREGAME_PRESET_IDS)[number];

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
};

export function clampIlePregameDifficulty(
  input?: Partial<IlePregameDifficulty> | null,
): IlePregameDifficulty {
  return {
    allowThoughtsPoolInsights: input?.allowThoughtsPoolInsights !== false,
    allowParallelWork: input?.allowParallelWork !== false,
    allowGatherResources: input?.allowGatherResources !== false,
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
  difficulty: IlePregameDifficulty,
): IlePregameDifficultyPresetId | null {
  const clamped = clampIlePregameDifficulty(difficulty);
  for (const preset of ILE_PREGAME_DIFFICULTY_PRESETS) {
    const want = clampIlePregameDifficulty(preset.difficulty);
    if (
      want.allowThoughtsPoolInsights === clamped.allowThoughtsPoolInsights &&
      want.allowParallelWork === clamped.allowParallelWork &&
      want.allowGatherResources === clamped.allowGatherResources
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
  mapType: string;
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
      mapType: DEFAULT_INITIAL_CHAPTERS,
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
      mapType: "ladder",
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
      mapType: "random_dense",
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
  mapType?: unknown;
}): IlePregameKnobs {
  const mapType = String(input.mapType ?? "").trim() || DEFAULT_INITIAL_CHAPTERS;
  return {
    powExpense: clampIlePowExpense(input.powExpense),
    insightSlotMax: clampIleTurnInsightSlotMax(input.insightSlotMax),
    gatherMaxPerSession: clampIleGatherMaxPerSession(input.gatherMaxPerSession),
    mapType,
  };
}

/** Apply a named setup. When the map is not choosable, keep the current map. */
export function applyIlePregamePreset(
  presetId: unknown,
  input?: { mapChoosable?: boolean; currentMap?: string | null },
): IlePregameKnobs {
  const preset =
    ILE_PREGAME_PRESETS.find((row) => row.id === presetId) ?? ILE_PREGAME_PRESETS[0];
  const knobs = clampIlePregameKnobs(preset.knobs);
  if (input?.mapChoosable === false) {
    const current = String(input.currentMap ?? "").trim();
    return { ...knobs, mapType: current || knobs.mapType };
  }
  return knobs;
}

export function ilePregameMatchingPresetId(
  knobs: IlePregameKnobs,
): IlePregamePresetId | null {
  const clamped = clampIlePregameKnobs(knobs);
  for (const preset of ILE_PREGAME_PRESETS) {
    const want = clampIlePregameKnobs(preset.knobs);
    if (
      want.powExpense === clamped.powExpense &&
      want.insightSlotMax === clamped.insightSlotMax &&
      want.gatherMaxPerSession === clamped.gatherMaxPerSession &&
      want.mapType === clamped.mapType
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
  "end-turn",
  "gather",
  "work-expense",
  "mark-done",
  "map-pan",
  "thought-memory",
] as const;

export type IleStartTipId = (typeof ILE_START_TIP_IDS)[number];

export const ILE_START_TIP_LABEL_KEYS: Record<IleStartTipId, string> = {
  "send-enter": "session.startTipSendEnter",
  "stash-del": "session.startTipStashDel",
  "end-turn": "session.startTipEndTurn",
  gather: "session.startTipGather",
  "work-expense": "session.startTipWorkExpense",
  "mark-done": "session.startTipMarkDone",
  "map-pan": "session.startTipMapPan",
  "thought-memory": "session.startTipThoughtMemory",
};

export const ILE_START_TIP_INTERVAL_MS = 5500;

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
