/**
 * Helios create-then-link for calibration/verification flows, and
 * content-block attachment args (links vs file URLs to ingest).
 */

import {
  mapBlockFromHeliosArgs,
  parseMapBlockAttachment,
  parseMapBlockAttachments,
  parseMapBlockKind,
  isFlowMapBlockKind,
  type MapBlock,
  type MapBlockAttachment,
} from "@/lib/block-kind";
import {
  emptyProductFlowDraft,
  type ProductFlowKind,
} from "@/lib/product-flow";

export type HeliosFlowCreateInput = {
  kind: ProductFlowKind;
  name: string;
  goal: string;
  topic: string;
  questions: string[];
  actionCatalog: number;
  durationMinutes: number;
};

export type HeliosCreatedFlow = {
  id: string;
  kind: ProductFlowKind;
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

/** True when Helios wants a new owner flow in the same add_block call. */
export function heliosWillCreateFlow(args: Record<string, unknown>): boolean {
  const kind = parseMapBlockKind(args.kind ?? args.blockKind);
  if (!isFlowMapBlockKind(kind)) return false;
  return !String(args.flowId ?? args.flow_id ?? "").trim();
}

export function heliosFlowCreateInput(
  args: Record<string, unknown>,
): HeliosFlowCreateInput {
  const parsed = parseMapBlockKind(args.kind ?? args.blockKind);
  const kind: ProductFlowKind =
    parsed === "calibration"
      ? "calibration"
      : parsed === "solve"
        ? "solve"
        : "verification";
  const name =
    text(args, "flowName", "flow_name", "name", "title", "prompt") ||
    (kind === "calibration"
      ? "Calibration flow"
      : kind === "solve"
        ? "Solve flow"
        : "Verification flow");
  const goal = text(args, "goal") || name;
  const topic = text(args, "topic") || name;
  let questions = heliosFlowQuestionsFromArgs(args);
  if (questions.length === 0) {
    questions = [kind === "calibration" ? goal : topic];
  }
  const draft = emptyProductFlowDraft(kind);
  const actionCatalog = Number(args.actionCatalog);
  const durationMinutes = Number(args.durationMinutes);
  return {
    kind,
    name: name.slice(0, 160),
    goal,
    topic,
    questions,
    actionCatalog: Number.isFinite(actionCatalog)
      ? actionCatalog
      : draft.actionCatalog,
    durationMinutes: Number.isFinite(durationMinutes)
      ? durationMinutes
      : draft.durationMinutes,
  };
}

export function heliosCreatedFlowFromUnknown(
  raw: unknown,
  fallbackKind: ProductFlowKind,
): HeliosCreatedFlow | null {
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const flow =
    rec.flow && typeof rec.flow === "object"
      ? (rec.flow as Record<string, unknown>)
      : rec;
  const id = String(flow.id ?? rec.id ?? "").trim();
  if (!id) return null;
  const kindRaw = String(rec.kind ?? flow.kind ?? fallbackKind);
  const kind: ProductFlowKind =
    kindRaw === "calibration" || kindRaw === "calibrate"
      ? "calibration"
      : kindRaw === "solve"
        ? "solve"
        : "verification";
  return {
    id,
    kind,
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
