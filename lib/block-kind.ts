/**
 * Learning Map tiles: Solve, Verification, Calibration, and Content.
 * A map is an assembly of those pieces (flows + content). Legacy Learn
 * tiles (missing `map_block`) still parse and launch Learn; authoring
 * never creates them.
 */

import { calibrationFlowPublicPath } from "@/lib/calibration-flow";
import { productFlowPagePath } from "@/lib/product-flow";
import { solveFlowPublicPath } from "@/lib/solve-flow";
import { verificationFlowPublicPath } from "@/lib/verification-flow";

export const MAP_BLOCK_KINDS = [
  "learn",
  "calibration",
  "verification",
  "solve",
  "content",
] as const;

export type MapBlockKind = (typeof MAP_BLOCK_KINDS)[number];

/** Kinds Helios and Manual may place. Learn is legacy stored data only. */
export const AUTHORING_MAP_BLOCK_KINDS = [
  "solve",
  "verification",
  "calibration",
  "content",
] as const;

export type AuthoringMapBlockKind = (typeof AUTHORING_MAP_BLOCK_KINDS)[number];

export const MAP_BLOCK_COLUMN = "map_block";

export const MAP_BLOCK_STORE_UNAVAILABLE =
  "This map cannot store calibration, verification, solve, or content blocks yet.";

/** Stored null / missing `map_block` is a legacy Learn tile. */
export const DEFAULT_MAP_BLOCK_KIND: MapBlockKind = "learn";

/** New tiles default to a Solve flow (the former implicit Learn session). */
export const DEFAULT_AUTHORING_MAP_BLOCK_KIND: AuthoringMapBlockKind = "solve";

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

export type MapBlockLaunchAction = "learn" | "calibrate" | "verify" | "solve" | "none";

export type MapBlockLaunch =
  | { action: "learn" }
  | { action: "calibrate"; flowId: string; href: string }
  | { action: "verify"; flowId: string; href: string }
  | { action: "solve"; flowId: string; href: string }
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
  solve: "solve",
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

export function isAuthoringMapBlockKind(
  value: unknown,
): value is AuthoringMapBlockKind {
  return (
    typeof value === "string" &&
    (AUTHORING_MAP_BLOCK_KINDS as readonly string[]).includes(value)
  );
}

/** New placement: unknown / Learn become Solve. */
export function parseAuthoringMapBlockKind(value: unknown): AuthoringMapBlockKind {
  const raw = String(value ?? "")
    .trim()
    .toLowerCase();
  if (!raw) return DEFAULT_AUTHORING_MAP_BLOCK_KIND;
  const kind = KIND_ALIASES[raw] ?? DEFAULT_AUTHORING_MAP_BLOCK_KIND;
  if (kind === "learn") return DEFAULT_AUTHORING_MAP_BLOCK_KIND;
  return kind;
}

/** Turn a stored/Helios payload into a placeable authoring tile (never Learn). */
export function coerceAuthoringMapBlock(raw?: unknown): MapBlock {
  const n = normalizeMapBlock(raw);
  if (n.kind !== "learn") return n;
  return {
    kind: DEFAULT_AUTHORING_MAP_BLOCK_KIND,
    flowId: n.flowId,
    flowPublicToken: n.flowPublicToken,
    flowHref: n.flowHref,
    attachments: [],
  };
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
): kind is "calibration" | "verification" | "solve" {
  return kind === "calibration" || kind === "verification" || kind === "solve";
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
  const kind = parseMapBlockKind(
    rec.kind ?? rec.blockKind ?? rec.block_kind ?? rec.type,
  );
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
  const flowHref =
    cleanUrl(rec.flowHref ?? rec.flow_href ?? rec.publicPath ?? rec.public_path) ||
    (flowPublicToken
      ? kind === "calibration"
        ? calibrationFlowPublicPath(flowPublicToken)
        : kind === "verification"
          ? verificationFlowPublicPath(flowPublicToken)
          : kind === "solve"
            ? solveFlowPublicPath(flowPublicToken)
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

/** Helios add_block args → MapBlock. Omitted or Learn kind becomes Solve. */
export function mapBlockFromHeliosArgs(args: Record<string, unknown>): MapBlock {
  const hasKind = args.kind != null || args.blockKind != null;
  const kind = hasKind
    ? parseAuthoringMapBlockKind(args.kind ?? args.blockKind)
    : DEFAULT_AUTHORING_MAP_BLOCK_KIND;
  return coerceAuthoringMapBlock({ ...args, kind });
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
 * Flow kinds require a flow id. Content and legacy Learn always place.
 * New authoring uses `mapBlockAuthoringPlaceError`.
 */
export function mapBlockPlaceError(block: MapBlock): string | null {
  if (isFlowMapBlockKind(block.kind) && !block.flowId) {
    return "flow_id_required";
  }
  return null;
}

/** New tiles cannot be Learn; flow tiles still need a flow id. */
export function mapBlockAuthoringPlaceError(block: MapBlock): string | null {
  if (block.kind === "learn") return "learn_block_retired";
  return mapBlockPlaceError(block);
}

/**
 * Kind (and content attachments) for a newly generated neighbor.
 * Flow tiles never copy the source flowId — each new tile mints its own
 * Solve / Verification / Calibration flow via `ensureAuthoringMapBlock`.
 * Content copies attachments. Legacy Learn becomes Solve.
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

/** Unsys seed studio is for Solve and Verification (and leftover Learn). */
export function mapBlockOffersUnsysModel(
  kind: string | null | undefined,
): boolean {
  const value = String(kind || "").trim();
  return value === "learn" || value === "solve" || value === "verification";
}

export function mapBlockFlowHref(block: MapBlock): string | null {
  if (!isFlowMapBlockKind(block.kind) || !block.flowId) return null;
  if (block.flowHref) return block.flowHref;
  if (block.flowPublicToken) {
    if (block.kind === "calibration") return calibrationFlowPublicPath(block.flowPublicToken);
    if (block.kind === "solve") return solveFlowPublicPath(block.flowPublicToken);
    return verificationFlowPublicPath(block.flowPublicToken);
  }
  return productFlowPagePath(
    block.kind === "calibration"
      ? "calibration"
      : block.kind === "solve"
        ? "solve"
        : "verification",
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
  if (block.kind === "solve") {
    return { action: "solve", flowId: block.flowId, href };
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

export function mapBlockAllowsSolve(raw: unknown): boolean {
  return mapBlockLaunch(raw).action === "solve";
}

export function mapBlockHasSessionLaunch(raw: unknown): boolean {
  const action = mapBlockLaunch(raw).action;
  return (
    action === "learn" ||
    action === "calibrate" ||
    action === "verify" ||
    action === "solve"
  );
}

export function mapBlockKindLabel(kind: MapBlockKind): string {
  if (kind === "calibration") return "Calibration";
  if (kind === "verification") return "Verification";
  if (kind === "solve") return "Solve";
  if (kind === "content") return "Content";
  return "Learn";
}

export function formatOwnerFlowsForHeliosPrompt(input: {
  calibration?: Array<{ id?: string; name?: string | null; goal?: string | null }>;
  verification?: Array<{ id?: string; name?: string | null; topic?: string | null }>;
  solve?: Array<{ id?: string; name?: string | null; topic?: string | null }>;
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
  const sol = (input.solve || [])
    .map((flow) => {
      const id = String(flow.id || "").trim();
      if (!id) return null;
      const name = String(flow.name || flow.topic || id).trim();
      return `- ${id} "${name}"`;
    })
    .filter(Boolean);
  return [
    "OWNER FLOWS (prefer these existing ids, especially flows already on this map). A Learning Map is Solve, Verification, Calibration, and Content tiles — never a Learn session tile. You pick the kind per cell. Reuse a listed flow when it fits; to create a new flow that belongs to this map, omit flowId on add_block and pass flowName plus goal (calibration) or topic (verification or solve). Solve needs name + topic only. Do not invent a UUID.",
    "Calibration flows (kind: calibration, argument flowId):",
    cal.join("\n") || "(none)",
    "Verification flows (kind: verification, argument flowId):",
    ver.join("\n") || "(none)",
    "Solve flows (kind: solve, argument flowId):",
    sol.join("\n") || "(none)",
  ].join("\n");
}
