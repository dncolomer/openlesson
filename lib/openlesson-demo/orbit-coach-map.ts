import type { OrbitAppSnapshot } from "./orbit-app-context";
import { isOrbitActionAvailable } from "./orbit-app-context";
import { orbitDemo } from "./demos/orbit";
import { ORBIT_UI_ACTIONS, type OrbitUiAction } from "./orbit-ui-manifest";

export type OrbitCoachTarget = OrbitUiAction & {
  score: number;
};

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function scoreHintAgainstAction(hint: string, action: OrbitUiAction): number {
  const normalized = normalizeText(hint);
  let score = 0;
  for (const keyword of action.keywords) {
    if (normalized.includes(keyword)) {
      score += keyword.split(" ").length > 1 ? 3 : 2;
    }
  }
  const demoAction = orbitDemo.actions.find((entry) => entry.id === action.actionId);
  if (demoAction) {
    if (normalized.includes(normalizeText(demoAction.label))) score += 4;
    if (normalized.includes(normalizeText(demoAction.blockHint))) score += 2;
  }
  return score;
}

export function matchCoachingHintToAction(
  hints: string[],
  snapshot?: OrbitAppSnapshot | null
): OrbitCoachTarget | null {
  const cleaned = hints.map((hint) => hint.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  const ranked: OrbitCoachTarget[] = [];
  for (const hint of cleaned) {
    for (const action of ORBIT_UI_ACTIONS) {
      const score = scoreHintAgainstAction(hint, action);
      if (score > 0) ranked.push({ ...action, score });
    }
  }

  ranked.sort((a, b) => b.score - a.score);

  for (const candidate of ranked) {
    if (candidate.score < 2) break;
    if (isOrbitActionAvailable(candidate.actionId, snapshot)) {
      return candidate;
    }
  }

  const suggested = snapshot?.suggested_next?.[0];
  if (suggested) {
    const fallback = ORBIT_UI_ACTIONS.find((action) => action.actionId === suggested);
    if (fallback) return { ...fallback, score: 1 };
  }

  return null;
}

export function getAffordanceForAction(
  actionId: string,
  snapshot?: OrbitAppSnapshot | null
): string | null {
  if (!snapshot) return null;
  return snapshot.affordances.find((entry) => entry.action_id === actionId)?.reason ?? null;
}

export function getCoachTargetForAction(actionId: string): OrbitUiAction | undefined {
  return ORBIT_UI_ACTIONS.find((action) => action.actionId === actionId);
}