/**
 * Shared live-stage HUD grammar for Calibrate, Learn, and Verify.
 * Index 01 sits on the stage. The line beside it is pass, policy, or time.
 */

import { formatCountdown } from "@/lib/tap-score-client-helpers";
import {
  recommendSessionBranchAction,
  type SessionBranchModel,
} from "@/lib/session-branch-model";

export const SESSION_STAGE_INDEX = "01";

export const FLOW_END_KICKERS = {
  calibrate: "Calibrate",
  learn: "Learn",
  verify: "Verify",
} as const;

export type SessionStageKind = keyof typeof FLOW_END_KICKERS;

export function sessionLearnPolicyProgressLabel(
  model: SessionBranchModel | null | undefined,
): string {
  if (!model) return "Policy";
  const recommended = recommendSessionBranchAction(model, model.focusId);
  if (!recommended) return "Policy";
  return `Policy · ${recommended.leads}`;
}

export function sessionStageProgressLine(input: {
  kind: SessionStageKind;
  pass?: number;
  passes?: number;
  policyLabel?: string | null;
  remainingSeconds?: number;
}): { index: string; label: string } {
  if (input.kind === "calibrate") {
    const pass = Math.max(1, Number(input.pass) || 1);
    const passes = Math.max(pass, Number(input.passes) || 2);
    return { index: SESSION_STAGE_INDEX, label: `Pass ${pass} of ${passes}` };
  }
  if (input.kind === "learn") {
    const label = String(input.policyLabel || "").trim() || "Learn";
    return { index: SESSION_STAGE_INDEX, label };
  }
  const seconds = Math.max(0, Math.floor(Number(input.remainingSeconds) || 0));
  return { index: SESSION_STAGE_INDEX, label: formatCountdown(seconds) };
}
