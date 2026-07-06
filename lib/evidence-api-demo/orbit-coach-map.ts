import type { SimulationAction } from "./types";
import { orbitDemo } from "./demos/orbit";

export type OrbitCoachTarget = {
  actionId: string;
  coachKey: string;
  label: string;
  keywords: string[];
};

export const ORBIT_COACH_TARGETS: OrbitCoachTarget[] = [
  { actionId: "open_inbox", coachKey: "inbox", label: "Open inbox", keywords: ["inbox", "triage", "unread"] },
  { actionId: "triage_issue", coachKey: "triage", label: "Triage issue", keywords: ["triage", "acknowledge", "review"] },
  { actionId: "create_issue", coachKey: "create-issue", label: "Create issue", keywords: ["create", "file", "new issue"] },
  { actionId: "set_priority_urgent", coachKey: "priority", label: "Set priority", keywords: ["urgent", "priority", "p0", "p1"] },
  { actionId: "assign_to_self", coachKey: "assign", label: "Assign issue", keywords: ["assign", "ownership", "owner", "take"] },
  { actionId: "change_status_in_progress", coachKey: "status", label: "Change status", keywords: ["in progress", "start", "status", "move"] },
  { actionId: "change_status_done", coachKey: "status", label: "Mark done", keywords: ["done", "complete", "close", "ship"] },
  { actionId: "add_label_bug", coachKey: "labels", label: "Add label", keywords: ["label", "bug", "regression", "defect"] },
  { actionId: "move_to_project", coachKey: "project", label: "Move to project", keywords: ["project", "sprint", "scope", "cycle"] },
  { actionId: "filter_by_assignee", coachKey: "filter", label: "Filter issues", keywords: ["filter", "assignee", "my issues"] },
  { actionId: "open_command_palette", coachKey: "command-palette", label: "Command palette", keywords: ["command", "cmd", "palette", "quick"] },
  { actionId: "add_comment", coachKey: "comment", label: "Add comment", keywords: ["comment", "context", "thread"] },
  { actionId: "start_cycle", coachKey: "cycle", label: "Start cycle", keywords: ["cycle", "sprint", "plan"] },
];

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9\s]/g, " ");
}

function scoreHintAgainstTarget(hint: string, target: OrbitCoachTarget): number {
  const normalized = normalizeText(hint);
  let score = 0;
  for (const keyword of target.keywords) {
    if (normalized.includes(keyword)) score += keyword.split(" ").length > 1 ? 3 : 2;
  }
  const action = orbitDemo.actions.find((entry) => entry.id === target.actionId);
  if (action) {
    if (normalized.includes(normalizeText(action.label))) score += 4;
    if (normalized.includes(normalizeText(action.blockHint))) score += 2;
  }
  return score;
}

export function matchCoachingHintToAction(hints: string[]): OrbitCoachTarget | null {
  const cleaned = hints.map((hint) => hint.trim()).filter(Boolean);
  if (cleaned.length === 0) return null;

  let best: { target: OrbitCoachTarget; score: number } | null = null;
  for (const hint of cleaned) {
    for (const target of ORBIT_COACH_TARGETS) {
      const score = scoreHintAgainstTarget(hint, target);
      if (!best || score > best.score) {
        best = { target, score };
      }
    }
  }

  return best && best.score > 0 ? best.target : null;
}

export function getCoachTargetForAction(actionId: string): OrbitCoachTarget | undefined {
  return ORBIT_COACH_TARGETS.find((target) => target.actionId === actionId);
}

export function getActionById(actionId: string): SimulationAction | undefined {
  return orbitDemo.actions.find((action) => action.id === actionId);
}