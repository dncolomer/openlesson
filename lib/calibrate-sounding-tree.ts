/**
 * Calibrate sounding tree and question pool. Tap/proof/finish live in
 * calibrate-sounding.
 */

import type { CalibrateQuestion } from "@/lib/calibrate-session";
import type { SessionBranchModel } from "@/lib/session-branch-model";

export const SOUNDING_SCREEN_SIZE = 3;
export const SOUNDING_MAX_SCREENS_PER_ROUND = 4;
export const SOUNDING_ROUND_COUNT = 2;
/** Enough stills for an opening of 3 plus at least one follow-up screen. */
export const SOUNDING_POOL_COUNT = 12;

export type SoundingStill = {
  id: string;
  text: string;
  observation: string;
  parentId: string | null;
  depth: number;
  territory: string;
};

export type SoundingScreen = {
  stills: SoundingStill[];
  grain: number;
};

export type SoundingRng = () => number;

export function soundingRng(seed: string): SoundingRng {
  let x = 2166136261;
  const text = String(seed || "sounding");
  for (let i = 0; i < text.length; i += 1) {
    x ^= text.charCodeAt(i);
    x = Math.imul(x, 16777619);
  }
  let n = x >>> 0;
  return () => {
    n = (Math.imul(n, 1664525) + 1013904223) >>> 0;
    return n / 4294967296;
  };
}

export function shuffleSoundingItems<T>(items: readonly T[], rnd: SoundingRng): T[] {
  const next = [...items];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const a = next[i]!;
    next[i] = next[j]!;
    next[j] = a;
  }
  return next;
}

function trimText(value: unknown): string {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

/**
 * Cards show the xAI-written question. Never wrap a title or territory
 * into a stock sentence.
 */
export function soundingStillCardText(input: {
  question?: string | null;
  title: string;
  observation?: string | null;
  territory?: string | null;
}): string {
  const question = trimText(input.question);
  if (question) return question;
  const title = trimText(input.title);
  if (title.includes("?")) return title;
  const observation = trimText(input.observation);
  if (observation.includes("?")) return observation;
  return title;
}

export function byId(stills: readonly SoundingStill[]): Map<string, SoundingStill> {
  return new Map(stills.map((still) => [still.id, still]));
}

export function childrenOf(
  stills: readonly SoundingStill[],
  parentIds: readonly string[],
): SoundingStill[] {
  const parents = new Set(parentIds);
  return stills.filter((still) => still.parentId && parents.has(still.parentId));
}

export function unusedOf(
  stills: readonly SoundingStill[],
  shownIds: readonly string[],
): SoundingStill[] {
  const shown = new Set(shownIds);
  return stills.filter((still) => !shown.has(still.id));
}

export function stillsAtDepth(stills: readonly SoundingStill[], depth: number): SoundingStill[] {
  return stills.filter((still) => still.depth === depth);
}

function pickDistinctTerritories(
  stills: readonly SoundingStill[],
  count: number,
  rnd: SoundingRng,
): SoundingStill[] {
  const shuffled = shuffleSoundingItems(stills, rnd);
  const picked: SoundingStill[] = [];
  const seen = new Set<string>();
  for (const still of shuffled) {
    const key = still.territory || still.parentId || still.id;
    if (seen.has(key)) continue;
    seen.add(key);
    picked.push(still);
    if (picked.length >= count) return picked;
  }
  for (const still of shuffled) {
    if (picked.some((row) => row.id === still.id)) continue;
    picked.push(still);
    if (picked.length >= count) return picked;
  }
  return picked;
}

export function pickScreen(
  candidates: readonly SoundingStill[],
  rnd: SoundingRng,
  minCount = SOUNDING_SCREEN_SIZE,
): SoundingScreen | null {
  if (candidates.length < minCount) return null;
  const stills = pickDistinctTerritories(candidates, SOUNDING_SCREEN_SIZE, rnd);
  if (stills.length < minCount) return null;
  const grain = Math.min(...stills.map((still) => still.depth));
  return { stills, grain };
}

export function pickFollowUpScreen(
  candidates: readonly SoundingStill[],
  rnd: SoundingRng,
): SoundingScreen | null {
  return pickScreen(candidates, rnd, 1);
}

export function padCandidates(
  preferred: readonly SoundingStill[],
  fallback: readonly SoundingStill[],
): SoundingStill[] {
  const ids = new Set(preferred.map((still) => still.id));
  const extra = fallback.filter((still) => !ids.has(still.id));
  return [...preferred, ...extra];
}

export function soundingStillsFromBranchModel(
  model: SessionBranchModel | null | undefined,
): SoundingStill[] {
  if (!model?.branches?.length) return [];
  const stills: SoundingStill[] = [];
  for (const branch of model.branches) {
    if (!branch || branch.parentId == null) continue;
    const title = trimText(branch.title) || trimText(branch.observation);
    if (!title) continue;
    const territory = trimText(branch.territory) || title;
    stills.push({
      id: String(branch.id),
      text: soundingStillCardText({
        question: branch.question,
        title,
        observation: branch.observation,
      }),
      observation: trimText(branch.observation) || title,
      parentId: branch.parentId,
      depth: Number.isFinite(branch.depth) ? Math.max(1, Math.floor(branch.depth)) : 1,
      territory,
    });
  }
  return stills;
}

export function soundingStillsFromQuestions(
  questions: readonly CalibrateQuestion[] | null | undefined,
): SoundingStill[] {
  const pool = (questions ?? [])
    .map((question, index) => ({
      id: trimText(question?.id) || `q-${index + 1}`,
      text: trimText(question?.text),
    }))
    .filter((question) => question.text);
  if (pool.length < SOUNDING_SCREEN_SIZE) return [];
  const roots = pool.slice(0, SOUNDING_SCREEN_SIZE);
  const stills: SoundingStill[] = roots.map((question) => ({
    id: question.id,
    text: soundingStillCardText({ title: question.text }),
    observation: question.text,
    parentId: "root",
    depth: 1,
    territory: question.id,
  }));
  const rest = pool.slice(SOUNDING_SCREEN_SIZE);
  rest.forEach((question, index) => {
    const root = roots[index % roots.length]!;
    const pass = Math.floor(index / roots.length);
    const depthTwo = stills.filter((still) => still.parentId === root.id);
    const parent = pass === 0 || depthTwo.length === 0 ? null : depthTwo[index % depthTwo.length]!;
    stills.push({
      id: question.id,
      text: soundingStillCardText({ title: question.text }),
      observation: question.text,
      parentId: parent?.id ?? root.id,
      depth: parent ? parent.depth + 1 : 2,
      territory: root.id,
    });
  });
  return stills;
}

export function mergeSoundingStills(
  primary: readonly SoundingStill[],
  extra: readonly SoundingStill[],
): SoundingStill[] {
  const taken = new Set(primary.map((still) => still.id));
  const merged = [...primary];
  for (const still of extra) {
    if (taken.has(still.id)) continue;
    taken.add(still.id);
    merged.push(still);
  }
  return merged;
}

export function soundingTreeIsTravelable(stills: readonly SoundingStill[]): boolean {
  if (stillsAtDepth(stills, 1).length < SOUNDING_SCREEN_SIZE) return false;
  if (stills.length - SOUNDING_SCREEN_SIZE >= SOUNDING_SCREEN_SIZE) return true;
  return stills.some((still) => still.depth >= 2);
}

export function createSoundingTree(input: {
  model?: SessionBranchModel | null;
  questions?: readonly CalibrateQuestion[] | null;
}): SoundingStill[] {
  const fromModel = soundingStillsFromBranchModel(input.model);
  const fromQuestions = soundingStillsFromQuestions(input.questions);
  if (soundingTreeIsTravelable(fromModel)) return fromModel;
  return mergeSoundingStills(fromModel, fromQuestions);
}
