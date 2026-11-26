/**
 * Learning Map tiles: Protocol / Verification and Content.
 * Leftover learn / solve / calibration tiles launch verification when they
 * have a token, otherwise they become content with no session.
 */

import { productFlowPagePath } from "@/lib/product-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";

export const MAP_BLOCK_KINDS = ["protocol", "verification", "content"] as const;

export type MapBlockKind = (typeof MAP_BLOCK_KINDS)[number];

/** Kinds Helios and Manual may place. */
export const AUTHORING_MAP_BLOCK_KINDS = ["verification", "content"] as const;

export type AuthoringMapBlockKind = (typeof AUTHORING_MAP_BLOCK_KINDS)[number];

export const MAP_BLOCK_COLUMN = "map_block";

export const MAP_BLOCK_STORE_UNAVAILABLE =
  "This map cannot store protocol, verification, or content blocks yet.";

/** Missing `map_block` is leftover content (no session). */
export const DEFAULT_MAP_BLOCK_KIND: MapBlockKind = "content";

/** New tiles default to a verification protocol. */
export const DEFAULT_AUTHORING_MAP_BLOCK_KIND: AuthoringMapBlockKind = "verification";

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

export type MapBlockLaunchAction = "verify" | "none";

export type MapBlockLaunch =
  | { action: "verify"; flowId: string; href: string }
  | { action: "none" };

const KIND_ALIASES: Record<string, MapBlockKind> = {
  protocol: "verification",
  verification: "verification",
  verify: "verification",
  content: "content",
  file: "content",
  files: "content",
  attachment: "content",
  attachments: "content",
};

const LEFTOVER_FLOW_KINDS = new Set([
  "learn",
  "learning",
  "default",
  "calibration",
  "calibrate",
  "scout",
  "solve",
]);

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

export function isAuthoringMapBlockKind(
  value: unknown,
): value is AuthoringMapBlockKind {
  return (
    typeof value === "string" &&
    (AUTHORING_MAP_BLOCK_KINDS as readonly string[]).includes(value)
  );
}

/** New placement: leftover learn / solve / calibration become verification. */
export function parseAuthoringMapBlockKind(value: unknown): AuthoringMapBlockKind {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return DEFAULT_AUTHORING_MAP_BLOCK_KIND;
  if (raw === "content" || raw === "file" || raw === "files") return "content";
  return DEFAULT_AUTHORING_MAP_BLOCK_KIND;
}

/** Turn a stored/Helios payload into a placeable authoring tile. */
export function coerceAuthoringMapBlock(raw?: unknown): MapBlock {
  const n = normalizeMapBlock(raw);
  if (n.kind === "content") return n;
  if (n.flowId || n.flowPublicToken) {
    return {
      kind: "verification",
      flowId: n.flowId,
      flowPublicToken: n.flowPublicToken,
      flowHref: n.flowHref || (n.flowPublicToken ? verificationFlowPublicPath(n.flowPublicToken) : n.flowHref),
      attachments: [],
    };
  }
  return emptyMapBlock("verification");
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
  const match = raw.match(/^\/[cvs]\/([^/?#]+)/i);
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
  return emptyMapBlock("content");
}

export function isLearnMapBlock(_block: MapBlock | null | undefined): boolean {
  return false;
}

export function isTypedMapBlock(block: MapBlock | null | undefined): boolean {
  return Boolean(block);
}

export function isFlowMapBlockKind(
  kind: MapBlockKind,
): kind is "protocol" | "verification" {
  return kind === "protocol" || kind === "verification";
}

function recordFromUnknown(raw: unknown): Record<string, unknown> | null {
  if (!raw || typeof raw === "string") return null;
  if (typeof raw !== "object" || Array.isArray(raw)) return null;
  return raw as Record<string, unknown>;
}

/**
 * Normalize DB/JSON/Helios/Manual payload into a MapBlock.
 * Missing/untyped values are legacy Learn. Authoring uses
 * `coerceAuthoringMapBlock` / `mapBlockFromHeliosArgs` instead.
 */
export function normalizeMapBlock(raw?: unknown): MapBlock {
  if (raw == null) return defaultMapBlock();
  if (typeof raw === "string") {
    const kind = parseMapBlockKind(raw);
    return emptyMapBlock(kind);
  }
  const rec = recordFromUnknown(raw);
  if (!rec) return defaultMapBlock();
  const rawKind = String(rec.kind ?? rec.blockKind ?? rec.block_kind ?? rec.type ?? "")
    .trim()
    .toLowerCase();
  const leftover = LEFTOVER_FLOW_KINDS.has(rawKind);
  const kind = leftover ? "verification" : parseMapBlockKind(rawKind);
  const flowId = cleanId(
    rec.flowId ??
      rec.flow_id ??
      rec.calibrationFlowId ??
      rec.calibration_flow_id ??
      rec.verificationFlowId ??
      rec.verification_flow_id ??
      rec.solveFlowId ??
      rec.solve_flow_id,
  );
  const flowPublicToken =
    cleanId(rec.flowPublicToken ?? rec.flow_public_token ?? rec.token ?? rec.publicToken) ||
    flowTokenFromPublicPath(rec.flowHref ?? rec.flow_href ?? rec.publicPath ?? rec.public_path);
  const storedHref = cleanUrl(rec.flowHref ?? rec.flow_href ?? rec.publicPath ?? rec.public_path);
  const flowHref =
    storedHref ||
    (flowPublicToken ? verificationFlowPublicPath(flowPublicToken) : null);
  const attachments = parseMapBlockAttachments(rec);
  if (isFlowMapBlockKind(kind) && (flowId || flowPublicToken)) {
    return {
      kind: "verification",
      flowId,
      flowPublicToken,
      flowHref,
      attachments: [],
    };
  }
  if (leftover && !flowId && !flowPublicToken) {
    return {
      kind: "content",
      flowId: null,
      flowPublicToken: null,
      flowHref: null,
      attachments,
    };
  }
  if (isFlowMapBlockKind(kind)) {
    return {
      kind: "verification",
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

/** Helios add_block args → MapBlock. Default kind is verification (a Protocol). */
export function mapBlockFromHeliosArgs(args: Record<string, unknown>): MapBlock {
  const hasKind = args.kind != null || args.blockKind != null;
  const kind = hasKind
    ? parseAuthoringMapBlockKind(args.kind ?? args.blockKind)
    : DEFAULT_AUTHORING_MAP_BLOCK_KIND;
  return coerceAuthoringMapBlock({ ...args, kind });
}

export function serializeMapBlock(block: MapBlock): Record<string, unknown> | null {
  const n = normalizeMapBlock(block);
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
 * Flow kinds require a flow id. Content and legacy Learn always place.
 * New authoring uses `mapBlockAuthoringPlaceError`.
 */
export function mapBlockPlaceError(block: MapBlock): string | null {
  if (isFlowMapBlockKind(block.kind) && !block.flowId) {
    return "flow_id_required";
  }
  return null;
}

/** Flow tiles still need a flow id. */
export function mapBlockAuthoringPlaceError(block: MapBlock): string | null {
  return mapBlockPlaceError(block);
}

/**
 * Kind (and content attachments) for a newly generated neighbor.
 * Flow tiles never copy the source flowId — each new tile mints its own
 * protocol via `ensureAuthoringMapBlock`. Content copies attachments.
 */
export function authoringMapBlockKindTemplate(raw?: unknown): MapBlock {
  const block = coerceAuthoringMapBlock(raw);
  if (block.kind === "content") return block;
  return emptyMapBlock(block.kind);
}

/**
 * Same as `authoringMapBlockKindTemplate`. Kept as the expand / bridge /
 * clone / generator payload helper.
 */
export function authoringMapBlockForReuse(raw: unknown): MapBlock {
  return authoringMapBlockKindTemplate(raw);
}

/** Unsys seed studio is for protocol / verification tiles. */
export function mapBlockOffersUnsysModel(
  kind: string | null | undefined,
): boolean {
  const value = String(kind || "").trim();
  return value === "protocol" || value === "verification";
}

export function mapBlockFlowHref(block: MapBlock): string | null {
  if (!isFlowMapBlockKind(block.kind) || !block.flowId) return null;
  if (block.flowHref) return block.flowHref;
  if (block.flowPublicToken) return verificationFlowPublicPath(block.flowPublicToken);
  return productFlowPagePath(block.flowId);
}

export function mapBlockLaunch(raw: unknown): MapBlockLaunch {
  const block = normalizeMapBlock(raw);
  if (block.kind === "content") return { action: "none" };
  if (!block.flowId && !block.flowPublicToken) return { action: "none" };
  const href = mapBlockFlowHref(block) || (block.flowPublicToken
    ? verificationFlowPublicPath(block.flowPublicToken)
    : null);
  if (!href || !block.flowId) return { action: "none" };
  return { action: "verify", flowId: block.flowId, href };
}

export function mapBlockAllowsLearn(_raw: unknown): boolean {
  return false;
}

export function mapBlockAllowsCalibrate(_raw: unknown): boolean {
  return false;
}

export function mapBlockAllowsVerify(raw: unknown): boolean {
  return mapBlockLaunch(raw).action === "verify";
}

export function mapBlockAllowsSolve(_raw: unknown): boolean {
  return false;
}

export function mapBlockHasSessionLaunch(raw: unknown): boolean {
  return mapBlockLaunch(raw).action === "verify";
}

export function mapBlockKindLabel(kind: MapBlockKind): string {
  if (kind === "content") return "Content";
  return "Protocol";
}

export function formatOwnerFlowsForHeliosPrompt(input: {
  verification?: Array<{ id?: string; name?: string | null; topic?: string | null; challenge?: string | null }>;
  protocol?: Array<{ id?: string; name?: string | null; topic?: string | null; challenge?: string | null }>;
}): string {
  const listed = [...(input.verification || []), ...(input.protocol || [])]
    .map((flow) => {
      const id = String(flow.id || "").trim();
      if (!id) return null;
      const name = String(flow.name || flow.challenge || flow.topic || id).trim();
      return `- ${id} "${name}"`;
    })
    .filter(Boolean);
  return [
    "OWNER PROTOCOLS (prefer these existing ids, especially protocols already on this map). A Learning Map is Protocol / Verification and Content tiles. Reuse a listed protocol when it fits; to create a new protocol that belongs to this map, omit flowId on add_block and pass flowName plus challenge. Do not invent a UUID.",
    "Protocols (kind: verification, argument flowId):",
    listed.join("\n") || "(none)",
  ].join("\n");
}
