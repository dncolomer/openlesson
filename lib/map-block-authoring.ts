/**
 * Server helper: every newly placed map tile is Solve, Verification,
 * Calibration, or Content. Missing Learn tiles become a Solve flow that
 * belongs to this map (owner-scoped, workspace_id stamped).
 * Expand / bridge / clone / generator pass a kind template (no flowId)
 * so each new tile mints its own flow instead of sharing a neighbor's.
 */

import {
  coerceAuthoringMapBlock,
  isFlowMapBlockKind,
  mapBlockAuthoringPlaceError,
  type MapBlock,
} from "@/lib/block-kind";
import { runCalibrationCommand } from "@/lib/calibration-flow-repository";
import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { runSolveCommand } from "@/lib/solve-flow-repository";
import { solveFlowPublicPath } from "@/lib/solve-flow";
import { runVerificationCommand } from "@/lib/verification-flow-repository";
import { verificationFlowPublicPath } from "@/lib/verification-flow";

export type EnsureAuthoringMapBlockInput = {
  raw?: unknown;
  title: string;
  topic?: string;
  goal?: string;
  problem?: string;
  artifacts?: unknown;
  ownerUserId: string;
  workspaceId: string;
};

export async function ensureAuthoringMapBlock(
  input: EnsureAuthoringMapBlockInput,
): Promise<{ ok: true; mapBlock: MapBlock } | { ok: false; error: string }> {
  const block = coerceAuthoringMapBlock(input.raw);
  if (block.kind === "content") return { ok: true, mapBlock: block };
  if (isFlowMapBlockKind(block.kind) && block.flowId) {
    return { ok: true, mapBlock: block };
  }
  if (!isFlowMapBlockKind(block.kind)) {
    return { ok: false, error: "learn_block_retired" };
  }

  const title = String(input.title || "").trim() || "Untitled";
  const topic =
    String(input.problem || input.topic || input.goal || title).trim() || title;
  const goal = topic;
  const ownerUserId = String(input.ownerUserId || "").trim();
  const workspaceId = String(input.workspaceId || "").trim();
  if (!ownerUserId) return { ok: false, error: "owner_required" };

  if (block.kind === "calibration") {
    const created = await runCalibrationCommand({
      type: "create",
      ownerUserId,
      workspaceId: workspaceId || undefined,
      name: title.slice(0, 160),
      goal,
      topic,
      artifacts: input.artifacts,
    });
    if (!created.ok || !created.flow) {
      return { ok: false, error: created.ok ? "create_flow_failed" : created.reason };
    }
    return {
      ok: true,
      mapBlock: {
        ...block,
        flowId: created.flow.id,
        flowPublicToken: created.flow.publicToken,
        flowHref: calibrationFlowPublicPath(created.flow.publicToken),
      },
    };
  }

  if (block.kind === "verification") {
    const created = await runVerificationCommand({
      type: "create",
      ownerUserId,
      workspaceId: workspaceId || undefined,
      name: title.slice(0, 160),
      topic,
      artifacts: input.artifacts,
    });
    if (!created.ok || !created.flow) {
      return { ok: false, error: created.ok ? "create_flow_failed" : created.reason };
    }
    return {
      ok: true,
      mapBlock: {
        ...block,
        flowId: created.flow.id,
        flowPublicToken: created.flow.publicToken,
        flowHref: verificationFlowPublicPath(created.flow.publicToken),
      },
    };
  }

  const created = await runSolveCommand({
    type: "create",
    ownerUserId,
    workspaceId: workspaceId || undefined,
    name: title.slice(0, 160),
    topic,
    artifacts: input.artifacts,
  });
  if (!created.ok || !created.flow) {
    return { ok: false, error: created.ok ? "create_flow_failed" : created.reason };
  }
  const next: MapBlock = {
    ...block,
    kind: "solve",
    flowId: created.flow.id,
    flowPublicToken: created.flow.publicToken,
    flowHref: solveFlowPublicPath(created.flow.publicToken),
  };
  const placeError = mapBlockAuthoringPlaceError(next);
  if (placeError) return { ok: false, error: placeError };
  return { ok: true, mapBlock: next };
}
