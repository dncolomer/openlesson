/**
 * Learning Map block kinds: Learn (default), calibration, verification, content.
 * Helios dispatch, Manual add/edit, clone, and launch gating share this parser.
 */

import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { productFlowPagePath } from "@/lib/product-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";

export const MAP_BLOCK_KINDS = [
  "learn",
  "calibration",
  "verification",
  "content",
] as const;

export type MapBlockKind = (typeof MAP_BLOCK_KINDS)[number];

export const MAP_BLOCK_COLUMN = "map_block";

export const MAP_BLOCK_STORE_UNAVAILABLE =
  "This map cannot store calibration, verification, or content blocks yet.";

export const DEFAULT_MAP_BLOCK_KIND: MapBlockKind = "learn";

export type MapBlockAttachmentType = "file" | "link";

export type MapBlockAttachment = {
  type: MapBlockAttachmentType;
  name: string;
  url?: string;
  mimeType?: string;
  xaiFileId?: string;
};

export type MapBlock = {
  kind: MapBlockKind;
  flowId: string | null;
  flowPublicToken: string | null;
  flowHref: string | null;
  attachments: MapBlockAttachment[];
};

export type MapBlockLaunchAction = "learn" | "calibrate" | "verify" | "none";

export type MapBlockLaunch =
  | { action: "learn" }
  | { action: "calibrate"; flowId: string; href: string }
  | { action: "verify"; flowId: string; href: string }
  | { action: "none" };

const KIND_ALIASES: Record<string, MapBlockKind> = {
  learn: "learn",
  learning: "learn",
  default: "learn",
  calibration: "calibration",
  calibrate: "calibration",
  scout: "calibration",
  verification: "verification",
  verify: "verification",
  content: "content",
  file: "content",
  files: "content",
  attachment: "content",
  attachments: "content",
};

export function isMapBlockKind(value: unknown): value is MapBlockKind {
  return (
    typeof value === "string" &&
    (MAP_BLOCK_KINDS as readonly string[]).includes(value)
  );
}

export function parseMapBlockKind(value: unknown): MapBlockKind {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  return KIND_ALIASES[raw] ?? DEFAULT_MAP_BLOCK_KIND;
}

function cleanId(value: unknown): string | null {
  const id = String(value ?? "").trim();
  return id || null;
}

function cleanUrl(value: unknown): string | null {
  const url = String(value ?? "").trim();
  if (!url) return null;
  if (/^https?:\/\//i.test(url) || url.startsWith("/")) return url;
  return null;
}

export function flowTokenFromPublicPath(path: unknown): string | null {
  const raw = String(path ?? "").trim();
  const match = raw.match(/^\/[cv]\/([^/?#]+)/i);
  if (!match) return null;
  try {
    return decodeURIComponent(match[1] || "").trim() || null;
  } catch {
    return match[1] || null;
  }
}

export function parseMapBlockAttachment(raw: unknown): MapBlockAttachment | null {
  if (typeof raw === "string") {
    const text = raw.trim();
    if (!text) return null;
    const url = cleanUrl(text);
    if (url) {
      return { type: "link", name: text, url };
    }
    return { type: "file", name: text };
  }
  if (!raw || typeof raw !== "object") return null;
  const rec = raw as Record<string, unknown>;
  const url = cleanUrl(rec.url ?? rec.href ?? rec.link);
  const name =
    String(rec.name ?? rec.title ?? rec.fileName ?? rec.file_name ?? url ?? "")
      .trim() || (url ? url : "");
  if (!name) return null;
  const typeRaw = String(rec.type ?? rec.kind ?? "").trim().toLowerCase();
  const mimeType = String(rec.mimeType ?? rec.mime_type ?? "").trim() || undefined;
  const xaiFileId =
    String(rec.xaiFileId ?? rec.xai_file_id ?? rec.fileId ?? rec.file_id ?? "").trim() ||
    undefined;
  const type: MapBlockAttachmentType =
    typeRaw === "file" || Boolean(xaiFileId)
      ? "file"
      : typeRaw === "link" || typeRaw === "url" || Boolean(url)
        ? "link"
        : "file";
  return {
    type,
    name,
    ...(url ? { url } : {}),
    ...(mimeType ? { mimeType } : {}),
    ...(xaiFileId ? { xaiFileId } : {}),
  };
}

export function parseMapBlockAttachments(raw: unknown): MapBlockAttachment[] {
  const lists: unknown[] = [];
  if (Array.isArray(raw)) lists.push(...raw);
  else if (raw && typeof raw === "object") {
    const rec = raw as Record<string, unknown>;
    if (Array.isArray(rec.attachments)) lists.push(...rec.attachments);
    if (Array.isArray(rec.files)) lists.push(...rec.files);
    if (Array.isArray(rec.links)) lists.push(...rec.links);
  }
  const out: MapBlockAttachment[] = [];
  const seen = new Set<string>();
  for (const item of lists) {
    const parsed = parseMapBlockAttachment(item);
    if (!parsed) continue;
    const key = `${parsed.type}:${parsed.url || parsed.xaiFileId || parsed.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(parsed);
    if (out.length >= 20) break;
  }
  return out;
}

function emptyMapBlock(kind: MapBlockKind = DEFAULT_MAP_BLOCK_KIND): MapBlock {
  return {
    kind,
    flowId: null,
    flowPublicToken: null,
    flowHref: null,
    attachments: [],
  };
}

export function defaultMapBlock(): MapBlock {
  return emptyMapBlock("learn");
}

export function isLearnMapBlock(block: MapBlock | null | undefined): boolean {
  return !block || block.kind === "learn";
}

export function isTypedMapBlock(block: MapBlock | null | undefined): boolean {
  return Boolean(block && block.kind !== "learn");
}

export function isFlowMapBlockKind(
  kind: MapBlockKind,
): kind is "calibration" | "verification" {
  return kind === "calibration" || kind === "verification";
}

function recordFromUnknown(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw === "string") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * Normalize DB/JSON/Helios/Manual payload into a MapBlock.
 * Missing/untyped values are Learn.
 */
export function normalizeMapBlock(raw?: unknown): MapBlock {
  if (raw == null) return defaultMapBlock();
  if (typeof raw === "string") {
    const kind = parseMapBlockKind(raw);
    return emptyMapBlock(kind);
  }
  const rec = recordFromUnknown(raw);
  if (!rec) return defaultMapBlock();
  const kind = parseMapBlockKind(
    rec.kind ?? rec.blockKind ?? rec.block_kind ?? rec.type,
  );
  const flowId = cleanId(
    rec.flowId ??
      rec.flow_id ??
      rec.calibrationFlowId ??
      rec.calibration_flow_id ??
      rec.verificationFlowId ??
      rec.verification_flow_id,
  );
  const flowPublicToken =
    cleanId(rec.flowPublicToken ?? rec.flow_public_token ?? rec.token ?? rec.publicToken) ||
    flowTokenFromPublicPath(rec.flowHref ?? rec.flow_href ?? rec.publicPath ?? rec.public_path);
  const flowHref =
    cleanUrl(rec.flowHref ?? rec.flow_href ?? rec.publicPath ?? rec.public_path) ||
    (flowPublicToken
      ? kind === "calibration"
        ? calibrationFlowPublicPath(flowPublicToken)
        : kind === "verification"
          ? verificationFlowPublicPath(flowPublicToken)
          : null
      : null);
  const attachments = parseMapBlockAttachments(rec);
  if (kind === "learn") return defaultMapBlock();
  if (isFlowMapBlockKind(kind)) {
    return {
      kind,
      flowId,
      flowPublicToken,
      flowHref,
      attachments: [],
    };
  }
  return {
    kind: "content",
    flowId: null,
    flowPublicToken: null,
    flowHref: null,
    attachments,
  };
}

export function parseMapBlock(raw: unknown): MapBlock {
  return normalizeMapBlock(raw);
}

/** Helios add_block args → MapBlock. */
export function mapBlockFromHeliosArgs(args: Record<string, unknown>): MapBlock {
  return normalizeMapBlock(args);
}

export function serializeMapBlock(block: MapBlock): Record<string, unknown> | null {
  const n = normalizeMapBlock(block);
  if (n.kind === "learn") return null;
  if (isFlowMapBlockKind(n.kind)) {
    return {
      kind: n.kind,
      flow_id: n.flowId,
      flow_public_token: n.flowPublicToken,
      flow_href: n.flowHref,
    };
  }
  return {
    kind: "content",
    attachments: n.attachments.map((item) => ({
      type: item.type,
      name: item.name,
      ...(item.url ? { url: item.url } : {}),
      ...(item.mimeType ? { mimeType: item.mimeType } : {}),
      ...(item.xaiFileId ? { xaiFileId: item.xaiFileId } : {}),
    })),
  };
}

export function withMapBlockColumn(
  payload: Record<string, unknown>,
  raw: unknown,
): Record<string, unknown> {
  const serialized = serializeMapBlock(normalizeMapBlock(raw));
  if (!serialized) return payload;
  return { ...payload, [MAP_BLOCK_COLUMN]: serialized };
}

/** Typed kinds must keep `map_block` on insert/update retry. */
export function droppedRequiredMapBlock(
  original: Record<string, unknown>,
  retry: Record<string, unknown>,
): boolean {
  return original[MAP_BLOCK_COLUMN] != null && retry[MAP_BLOCK_COLUMN] == null;
}

export function restoreRequiredMapBlock(
  original: Record<string, unknown>,
  retry: Record<string, unknown>,
): Record<string, unknown> {
  if (original[MAP_BLOCK_COLUMN] == null) return retry;
  const next: Record<string, unknown> = {
    ...retry,
    [MAP_BLOCK_COLUMN]: original[MAP_BLOCK_COLUMN],
  };
  if (original.map_icon != null && next.map_icon == null) {
    next.map_icon = original.map_icon;
  }
  return next;
}

/**
 * Flow kinds require a flow id. Content and Learn always place.
 */
export function mapBlockPlaceError(block: MapBlock): string | null {
  if (isFlowMapBlockKind(block.kind) && !block.flowId) {
    return "flow_id_required";
  }
  return null;
}

export function mapBlockFlowHref(block: MapBlock): string | null {
  if (!isFlowMapBlockKind(block.kind) || !block.flowId) return null;
  if (block.flowHref) return block.flowHref;
  if (block.flowPublicToken) {
    return block.kind === "calibration"
      ? calibrationFlowPublicPath(block.flowPublicToken)
      : verificationFlowPublicPath(block.flowPublicToken);
  }
  return productFlowPagePath(
    block.kind === "calibration" ? "calibration" : "verification",
    block.flowId,
  );
}

export function mapBlockLaunch(raw: unknown): MapBlockLaunch {
  const block = normalizeMapBlock(raw);
  if (block.kind === "learn") return { action: "learn" };
  if (block.kind === "content") return { action: "none" };
  if (!block.flowId) return { action: "none" };
  const href = mapBlockFlowHref(block);
  if (!href) return { action: "none" };
  if (block.kind === "calibration") {
    return { action: "calibrate", flowId: block.flowId, href };
  }
  return { action: "verify", flowId: block.flowId, href };
}

export function mapBlockAllowsLearn(raw: unknown): boolean {
  return mapBlockLaunch(raw).action === "learn";
}

export function mapBlockAllowsCalibrate(raw: unknown): boolean {
  return mapBlockLaunch(raw).action === "calibrate";
}

export function mapBlockAllowsVerify(raw: unknown): boolean {
  return mapBlockLaunch(raw).action === "verify";
}

export function mapBlockHasSessionLaunch(raw: unknown): boolean {
  const action = mapBlockLaunch(raw).action;
  return action === "learn" || action === "calibrate" || action === "verify";
}

export function mapBlockKindLabel(kind: MapBlockKind): string {
  if (kind === "calibration") return "Calibration";
  if (kind === "verification") return "Verification";
  if (kind === "content") return "Content";
  return "Learn";
}

export function formatOwnerFlowsForHeliosPrompt(input: {
  calibration?: Array<{ id?: string; name?: string | null; goal?: string | null }>;
  verification?: Array<{ id?: string; name?: string | null; topic?: string | null }>;
}): string {
  const cal = (input.calibration || [])
    .map((flow) => {
      const id = String(flow.id || "").trim();
      if (!id) return null;
      const name = String(flow.name || flow.goal || id).trim();
      return `- ${id} "${name}"`;
    })
    .filter(Boolean);
  const ver = (input.verification || [])
    .map((flow) => {
      const id = String(flow.id || "").trim();
      if (!id) return null;
      const name = String(flow.name || flow.topic || id).trim();
      return `- ${id} "${name}"`;
    })
    .filter(Boolean);
  return [
    "OWNER FLOWS (link these existing ids — do not invent a flow id)",
    "Calibration flows (kind: calibration, argument flowId):",
    cal.join("\n") || "(none)",
    "Verification flows (kind: verification, argument flowId):",
    ver.join("\n") || "(none)",
  ].join("\n");
}
