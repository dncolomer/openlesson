/**
 * Helios create-then-link for protocols, and content-block attachment
 * args (links vs file URLs to ingest).
 */

import {
  mapBlockFromHeliosArgs,
  parseMapBlockAttachment,
  parseMapBlockAttachments,
  parseAuthoringMapBlockKind,
  isFlowMapBlockKind,
  type MapBlock,
  type MapBlockAttachment,
} from "@/lib/block-kind";
import {
  emptyProductFlowDraft,
  parseExactProblemOnCanvas,
  protocolChallengeFromUnknown,
} from "@/lib/product-flow";
import { parseFlowArtifacts, type FlowArtifact } from "@/lib/flow-artifacts";

export type HeliosFlowCreateInput = {
  name: string;
  challenge: string;
  artifacts: FlowArtifact[];
  exactProblemOnCanvas: boolean;
  generateProblemOnOpen: boolean;
  actionCatalog: number;
  durationMinutes: number;
  workspaceId?: string;
};

export type HeliosCreatedFlow = {
  id: string;
  name: string;
  publicToken?: string | null;
  publicPath?: string | null;
};

function text(args: Record<string, unknown>, ...keys: string[]): string {
  for (const key of keys) {
    const value = args[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return "";
}

export function heliosFlowQuestionsFromArgs(
  args: Record<string, unknown>,
): string[] {
  const raw = args.questions;
  if (Array.isArray(raw)) {
    return raw.map((item) => String(item ?? "").trim()).filter(Boolean);
  }
  if (typeof raw === "string" && raw.trim()) return [raw.trim()];
  return [];
}

/** True when Helios wants a new owner protocol in the same add_block / generate_shape call. */
export function heliosWillCreateFlow(args: Record<string, unknown>): boolean {
  const kind = parseAuthoringMapBlockKind(args.kind ?? args.blockKind);
  if (!isFlowMapBlockKind(kind)) return false;
  return !String(args.flowId ?? args.flow_id ?? "").trim();
}

export function heliosFlowCreateInput(
  args: Record<string, unknown>,
): HeliosFlowCreateInput {
  const name = text(args, "flowName", "flow_name", "name", "title", "prompt") || "Protocol";
  const challenge =
    protocolChallengeFromUnknown({
      challenge: args.challenge,
      problem: args.problem,
      topic: args.topic,
      goal: args.goal,
    }) || name;
  const draft = emptyProductFlowDraft();
  const actionCatalog = Number(args.actionCatalog);
  const durationMinutes = Number(args.durationMinutes);
  const workspaceId = text(args, "workspaceId", "workspace_id");
  return {
    name: name.slice(0, 160),
    challenge,
    artifacts: parseFlowArtifacts(args.artifacts),
    exactProblemOnCanvas: parseExactProblemOnCanvas(
      args.exactProblemOnCanvas ?? args.exact_problem_on_canvas,
    ),
    generateProblemOnOpen: parseExactProblemOnCanvas(
      args.generateProblemOnOpen ?? args.generate_problem_on_open,
    ),
    actionCatalog: Number.isFinite(actionCatalog)
      ? actionCatalog
      : draft.actionCatalog,
    durationMinutes: Number.isFinite(durationMinutes)
      ? durationMinutes
      : draft.durationMinutes,
    ...(workspaceId ? { workspaceId } : {}),
  };
}

export function heliosCreatedFlowFromUnknown(raw: unknown): HeliosCreatedFlow | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const flow =
    rec.flow && typeof rec.flow === "object"
      ? (rec.flow as Record<string, unknown>)
      : rec;
  const id = String(flow.id ?? rec.id ?? "").trim();
  if (!id) return null;
  return {
    id,
    name: String(flow.name ?? rec.name ?? id).trim() || id,
    publicToken: String(flow.publicToken ?? flow.public_token ?? "").trim() || null,
    publicPath:
      String(rec.publicPath ?? rec.public_path ?? flow.publicPath ?? "").trim() ||
      null,
  };
}

function asTypedAttachment(
  item: unknown,
  type: MapBlockAttachment["type"],
): MapBlockAttachment | null {
  if (typeof item === "string") {
    return parseMapBlockAttachment({ type, name: item, url: item });
  }
  if (!item || typeof item !== "object") return null;
  return parseMapBlockAttachment({ type, ...(item as Record<string, unknown>) });
}

/** files[] ingest as file URLs; links[] stay links; attachments[] keep type. */
export function heliosMapBlockAttachmentsFromArgs(
  args: Record<string, unknown>,
): MapBlockAttachment[] {
  const files = Array.isArray(args.files)
    ? args.files.map((item) => asTypedAttachment(item, "file"))
    : [];
  const links = Array.isArray(args.links)
    ? args.links.map((item) => asTypedAttachment(item, "link"))
    : [];
  const listed = parseMapBlockAttachments(args.attachments);
  return parseMapBlockAttachments(
    [...files, ...links, ...listed].filter(Boolean),
  );
}

export function heliosResolvedMapBlock(
  args: Record<string, unknown>,
): MapBlock {
  const block = mapBlockFromHeliosArgs(args);
  if (block.kind !== "content") return block;
  return { ...block, attachments: heliosMapBlockAttachmentsFromArgs(args) };
}
