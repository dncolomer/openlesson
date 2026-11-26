/**
 * Server helper: every newly placed map tile is Protocol / Verification
 * or Content. Leftover Learn / Solve / Calibration tiles become a
 * verification protocol that belongs to this map when they have no flow id.
 */

import {
  coerceAuthoringMapBlock,
  isFlowMapBlockKind,
  mapBlockAuthoringPlaceError,
  type MapBlock,
} from "@/lib/block-kind";
import { parseExactProblemOnCanvas, parseGenerateProblemOnOpen } from "@/lib/product-flow";
import { runVerificationCommand } from "@/lib/verification-flow-repository";
import { verificationFlowPublicPath } from "@/lib/verification-flow";

export type EnsureAuthoringMapBlockInput = {
  raw?: unknown;
  title: string;
  topic?: string;
  goal?: string;
  problem?: string;
  challenge?: string;
  artifacts?: unknown;
  exactProblemOnCanvas?: unknown;
  generateProblemOnOpen?: unknown;
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
    return { ok: true, mapBlock: { ...block, kind: "content" } };
  }

  const title = String(input.title || "").trim() || "Untitled";
  const topic =
    String(input.challenge || input.problem || input.topic || input.goal || title).trim() ||
    title;
  const ownerUserId = String(input.ownerUserId || "").trim();
  const workspaceId = String(input.workspaceId || "").trim();
  if (!ownerUserId) return { ok: false, error: "owner_required" };

  const created = await runVerificationCommand({
    type: "create",
    ownerUserId,
    workspaceId: workspaceId || undefined,
    name: title.slice(0, 160),
    topic,
    artifacts: input.artifacts,
    exactProblemOnCanvas: parseExactProblemOnCanvas(input.exactProblemOnCanvas),
    generateProblemOnOpen: parseGenerateProblemOnOpen(input.generateProblemOnOpen),
  });
  if (!created.ok || !created.flow) {
    return { ok: false, error: created.ok ? "create_flow_failed" : created.reason };
  }
  const next: MapBlock = {
    ...block,
    kind: "verification",
    flowId: created.flow.id,
    flowPublicToken: created.flow.publicToken,
    flowHref: verificationFlowPublicPath(created.flow.publicToken),
  };
  const placeError = mapBlockAuthoringPlaceError(next);
  if (placeError) return { ok: false, error: placeError };
  return { ok: true, mapBlock: next };
}
