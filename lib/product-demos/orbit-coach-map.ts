import type { OrbitAppSnapshot } from "./orbit-app-context";
import { isOrbitActionAvailable } from "./orbit-app-context";
import { orbitDemo } from "./demos/orbit";
import { ORBIT_UI_ACTIONS, type OrbitUiAction } from "./orbit-ui-manifest";

export type OrbitCoachTarget = OrbitUiAction & {
  score: number;
  source: "hint" | "snapshot";
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

function suggestedNextRank(actionId: string, snapshot?: OrbitAppSnapshot | null): number {
  if (!snapshot) return 999;
  const idx = snapshot.suggested_next.indexOf(actionId);
  return idx === -1 ? 999 : idx;
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
      let score = scoreHintAgainstAction(hint, action);
      // Prefer the concrete triage click over mere inbox navigation when both match.
      if (action.actionId === "triage_issue" && /\btriage\b/.test(normalizeText(hint))) {
        score += 3;
      }
      if (action.actionId === "open_inbox" && /\btriage\b/.test(normalizeText(hint))) {
        score -= 1;
      }
      if (score > 0) ranked.push({ ...action, score, source: "hint" });
    }
  }

  ranked.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return suggestedNextRank(a.actionId, snapshot) - suggestedNextRank(b.actionId, snapshot);
  });

  for (const candidate of ranked) {
    if (candidate.score < 2) break;
    if (isOrbitActionAvailable(candidate.actionId, snapshot)) {
      return candidate;
    }
  }

  return null;
}

/**
 * Single primary next step for the demo path.
 * Prefer scorecard-hint mapping when available; otherwise use learning-ordered
 * snapshot.suggested_next so coaching is exact even before the first report.
 */
export function resolveOrbitPrimaryCoachStep(
  hints: string[],
  snapshot?: OrbitAppSnapshot | null
): OrbitCoachTarget | null {
  const fromHints = matchCoachingHintToAction(hints, snapshot);
  if (fromHints && isOrbitActionAvailable(fromHints.actionId, snapshot)) {
    return fromHints;
  }

  if (!snapshot) return null;

  for (const actionId of snapshot.suggested_next) {
    if (!isOrbitActionAvailable(actionId, snapshot)) continue;
    const action = ORBIT_UI_ACTIONS.find((entry) => entry.actionId === actionId);
    if (!action) continue;
    return { ...action, score: 1, source: "snapshot" };
  }

  // Last resort: first available affordance with a concrete reason.
  const available = snapshot.affordances.find((entry) => entry.available);
  if (available) {
    const action = ORBIT_UI_ACTIONS.find((entry) => entry.actionId === available.action_id);
    if (action) return { ...action, score: 0, source: "snapshot" };
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

/** Human-facing exact step: where to click (prefer snapshot affordance path for focus/project). */
export function formatExactCoachInstruction(
  target: OrbitCoachTarget,
  snapshot?: OrbitAppSnapshot | null
): string {
  if (target.actionId === "open_project_view" && snapshot?.focus_project_name) {
    return `Sidebar → Projects → ${snapshot.focus_project_name}`;
  }
  if (target.actionId === "focus_issue" && snapshot?.focus_issue_identifier) {
    const title =
      snapshot.issues.find((issue) => issue.id === snapshot.focus_issue_id)?.title ?? "";
    return `Issue list → click ${snapshot.focus_issue_identifier}${
      title ? ` (${title.slice(0, 48)}${title.length > 48 ? "…" : ""})` : ""
    }`;
  }
  const affordance = getAffordanceForAction(target.actionId, snapshot);
  if (affordance?.includes("→")) {
    // Affordance already encodes a click path (e.g. focus_issue / open_project_view).
    const path = affordance.split(". ")[0]?.trim();
    if (path && /→|click|sidebar|header|dropdown|cmd/i.test(path)) {
      return path;
    }
  }
  return target.instruction;
}
