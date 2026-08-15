/**
 * Practice Portal — workspace-scoped guest mint desk.
 *
 * Owners configure which product intents and timings a shareable portal
 * may offer; visitors open the portal URL and mint a one-shot TAP/ILE
 * guest link without needing the map catalog or public workspace.
 *
 * Product axes: Explore|Drill × Dialog|Solo
 * - Explore → always ILE (dialog = learning, solo = project)
 * - Drill → always TAP (dialog = conversational, solo = exercise)
 *
 * Pure helpers live here so unit tests do not need Supabase/API I/O.
 * Legacy open_ended_* / timed_* ids are accepted on read and canonicalized.
 */

import {
  allProductLaunchTargets,
  canonicalizeProductIntentId,
  productIntentToCreateFields,
  resolveProductIntent,
  resolveProductIntentFromId,
  type ProductIntentId,
  type ProductLaunchTarget,
} from "@/lib/product-intent";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
  normalizeTapLinkMinutes,
} from "@/lib/pow-api/tap-link-config";

/** Canonical product intents a portal may enable (Explore/Drill × Dialog/Solo). */
export const PRACTICE_PORTAL_PRODUCT_IDS = [
  "explore_dialog",
  "explore_solo",
  "drill_dialog",
  "drill_solo",
] as const;

export type PracticePortalProductId = (typeof PRACTICE_PORTAL_PRODUCT_IDS)[number];

/** @deprecated Legacy ids still accepted via parsePracticePortalProductId. */
export const PRACTICE_PORTAL_LEGACY_PRODUCT_IDS = [
  "open_ended_explore",
  "open_ended_drill",
  "timed_explore",
  "timed_drill",
] as const;

/** Duration choices offered when configuring Drill · Dialog (minutes). */
export const PRACTICE_PORTAL_DRILL_DIALOG_OPTIONS = [5, 10, 15, 30, 45, 60] as const;

/** Duration choices offered when configuring Drill · Solo (minutes). */
export const PRACTICE_PORTAL_DRILL_SOLO_OPTIONS = [15, 30, 45, 60, 90] as const;

/** @deprecated Prefer PRACTICE_PORTAL_DRILL_DIALOG_OPTIONS */
export const PRACTICE_PORTAL_TIMED_EXPLORE_OPTIONS = PRACTICE_PORTAL_DRILL_DIALOG_OPTIONS;

/** @deprecated Prefer PRACTICE_PORTAL_DRILL_SOLO_OPTIONS */
export const PRACTICE_PORTAL_TIMED_DRILL_OPTIONS = PRACTICE_PORTAL_DRILL_SOLO_OPTIONS;

/** Default Drill · Dialog minutes when a portal enables that product without timings. */
export const PRACTICE_PORTAL_DEFAULT_DRILL_DIALOG_MINUTES: readonly number[] = [5, 10, 30];

/** Default Drill · Solo minutes when a portal enables that product without timings. */
export const PRACTICE_PORTAL_DEFAULT_DRILL_SOLO_MINUTES: readonly number[] = [15, 30, 45];

/** @deprecated Prefer PRACTICE_PORTAL_DEFAULT_DRILL_DIALOG_MINUTES */
export const PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES =
  PRACTICE_PORTAL_DEFAULT_DRILL_DIALOG_MINUTES;

/** @deprecated Prefer PRACTICE_PORTAL_DEFAULT_DRILL_SOLO_MINUTES */
export const PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES =
  PRACTICE_PORTAL_DEFAULT_DRILL_SOLO_MINUTES;

/**
 * Timings for Drill (TAP) products. Explore (ILE) products have no duration list.
 * Keys use both canonical and legacy aliases for storage compatibility.
 */
export type PracticePortalTimings = {
  drill_dialog: number[];
  drill_solo: number[];
  /** Legacy alias of drill_dialog (stored configs). */
  timed_explore: number[];
  /** Legacy alias of drill_solo (stored configs). */
  timed_drill: number[];
};

/**
 * Practice scope for portal visitors.
 * - visitor_pick: visitor chooses a block (block_id null)
 * - fixed_block: single fixed block_id (visitor cannot change)
 * - workspace: force entire workspace — no block choice; mint with null block_id
 */
export type PracticePortalScopeMode = "visitor_pick" | "fixed_block" | "workspace";

export const PRACTICE_PORTAL_SCOPE_MODES = [
  "visitor_pick",
  "fixed_block",
  "workspace",
] as const;

export type PracticePortalConfig = {
  allowed_products: PracticePortalProductId[];
  timings: PracticePortalTimings;
  /**
   * Optional fixed workspace block for this portal.
   * When set (and scope_mode is fixed_block), Explore (ILE) mints use it without
   * a visitor block pick; Drill (TAP) mints also default to this block when provided.
   * Always null when scope_mode is workspace.
   */
  block_id: string | null;
  /**
   * Explicit scope policy. Distinct from `block_id: null` alone (visitor pick).
   * `workspace` forces map-level practice with no block choice on the public desk.
   */
  scope_mode: PracticePortalScopeMode;
};

export type PracticePortalMintRequest = {
  product_id?: unknown;
  minutes?: unknown;
  block_id?: unknown;
};

export type PracticePortalMintValidation =
  | {
      ok: true;
      product_id: PracticePortalProductId;
      minutes: number | null;
      launch: ProductLaunchTarget;
      block_id: string | null;
    }
  | {
      ok: false;
      error: string;
      code:
        | "validation_error"
        | "product_not_allowed"
        | "timing_not_allowed"
        | "block_required";
    };

const PRODUCT_ID_SET = new Set<string>(PRACTICE_PORTAL_PRODUCT_IDS);
const LEGACY_ID_SET = new Set<string>(PRACTICE_PORTAL_LEGACY_PRODUCT_IDS);

function isDrillProduct(id: PracticePortalProductId): boolean {
  return id === "drill_dialog" || id === "drill_solo";
}

function isExploreProduct(id: PracticePortalProductId): boolean {
  return id === "explore_dialog" || id === "explore_solo";
}

/** @deprecated Prefer isExploreProduct — Explore = ILE (no duration). */
function isOpenEndedProduct(id: PracticePortalProductId): boolean {
  return isExploreProduct(id);
}

/** @deprecated Prefer isDrillProduct — Drill = TAP (duration). */
function isTimedProduct(id: PracticePortalProductId): boolean {
  return isDrillProduct(id);
}

/** Map product intent id → ProductLaunchTarget via shipped resolveProductIntent. */
export function launchTargetForPracticePortalProduct(
  productId: PracticePortalProductId | string,
): ProductLaunchTarget {
  return resolveProductIntentFromId(productId);
}

/**
 * Parse product id (canonical or legacy) → canonical PracticePortalProductId.
 * Unknown → null (never invent a default product from garbage ids).
 */
export function parsePracticePortalProductId(
  value: unknown,
): PracticePortalProductId | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (PRODUCT_ID_SET.has(raw)) return raw as PracticePortalProductId;
  if (LEGACY_ID_SET.has(raw)) {
    return canonicalizeProductIntentId(raw) as PracticePortalProductId;
  }
  return null;
}

function clampMinutesList(
  values: unknown,
  fallback: readonly number[],
): number[] {
  const source = Array.isArray(values) ? values : [];
  const out: number[] = [];
  for (const item of source) {
    const n =
      typeof item === "number"
        ? item
        : typeof item === "string"
          ? Number(item.trim())
          : NaN;
    if (!Number.isFinite(n)) continue;
    const clamped = Math.min(
      Math.max(Math.trunc(n), TAP_LINK_MIN_MINUTES),
      TAP_LINK_MAX_MINUTES,
    );
    if (!out.includes(clamped)) out.push(clamped);
  }
  out.sort((a, b) => a - b);
  if (out.length === 0) {
    return fallback.map((m) =>
      Math.min(Math.max(Math.trunc(m), TAP_LINK_MIN_MINUTES), TAP_LINK_MAX_MINUTES),
    );
  }
  return out;
}

function emptyTimings(): PracticePortalTimings {
  return {
    drill_dialog: [],
    drill_solo: [],
    timed_explore: [],
    timed_drill: [],
  };
}

/**
 * Normalize raw create/config JSON into a durable portal config.
 * - Invalid product ids are dropped; legacy ids are canonicalized.
 * - Empty/missing allowed_products → all four products.
 * - Drill products without timings get map-aligned defaults.
 * - Timings for disabled Drill products are cleared.
 */
export function normalizePracticePortalConfig(input: unknown): PracticePortalConfig {
  const record =
    input && typeof input === "object" && !Array.isArray(input)
      ? (input as Record<string, unknown>)
      : {};

  const rawProducts = Array.isArray(record.allowed_products)
    ? record.allowed_products
    : Array.isArray(record.allowedProducts)
      ? record.allowedProducts
      : Array.isArray(record.products)
        ? record.products
        : null;

  let allowed: PracticePortalProductId[] = [];
  if (rawProducts && rawProducts.length > 0) {
    for (const item of rawProducts) {
      const id = parsePracticePortalProductId(item);
      if (id && !allowed.includes(id)) allowed.push(id);
    }
  }
  if (allowed.length === 0) {
    allowed = [...PRACTICE_PORTAL_PRODUCT_IDS];
  }

  // Stable UI order
  allowed = PRACTICE_PORTAL_PRODUCT_IDS.filter((id) => allowed.includes(id));

  const timingsRaw =
    record.timings && typeof record.timings === "object" && !Array.isArray(record.timings)
      ? (record.timings as Record<string, unknown>)
      : {};

  const drillDialogAllowed = allowed.includes("drill_dialog");
  const drillSoloAllowed = allowed.includes("drill_solo");

  const drill_dialog = drillDialogAllowed
    ? clampMinutesList(
        timingsRaw.drill_dialog ??
          timingsRaw.drillDialog ??
          timingsRaw.timed_explore ??
          timingsRaw.timedExplore,
        PRACTICE_PORTAL_DEFAULT_DRILL_DIALOG_MINUTES,
      )
    : [];

  const drill_solo = drillSoloAllowed
    ? clampMinutesList(
        timingsRaw.drill_solo ??
          timingsRaw.drillSolo ??
          timingsRaw.timed_drill ??
          timingsRaw.timedDrill,
        PRACTICE_PORTAL_DEFAULT_DRILL_SOLO_MINUTES,
      )
    : [];

  const blockRaw =
    typeof record.block_id === "string"
      ? record.block_id
      : typeof record.blockId === "string"
        ? record.blockId
        : typeof record.fixed_block_id === "string"
          ? record.fixed_block_id
          : typeof record.fixedBlockId === "string"
            ? record.fixedBlockId
            : "";
  let block_id = blockRaw.trim() || null;

  const scopeRaw =
    typeof record.scope_mode === "string"
      ? record.scope_mode
      : typeof record.scopeMode === "string"
        ? record.scopeMode
        : typeof record.scope === "string"
          ? record.scope
          : typeof record.force_workspace === "boolean" && record.force_workspace
            ? "workspace"
            : typeof record.forceWorkspace === "boolean" && record.forceWorkspace
              ? "workspace"
              : "";
  const scopeNormalized = String(scopeRaw || "")
    .trim()
    .toLowerCase()
    .replace(/-/g, "_");

  let scope_mode: PracticePortalScopeMode;
  if (
    scopeNormalized === "workspace" ||
    scopeNormalized === "entire_workspace" ||
    scopeNormalized === "workspace_level" ||
    scopeNormalized === "force_workspace"
  ) {
    scope_mode = "workspace";
    block_id = null;
  } else if (
    scopeNormalized === "fixed_block" ||
    scopeNormalized === "fixed" ||
    scopeNormalized === "block"
  ) {
    scope_mode = block_id ? "fixed_block" : "visitor_pick";
  } else if (
    scopeNormalized === "visitor_pick" ||
    scopeNormalized === "visitor" ||
    scopeNormalized === "pick"
  ) {
    scope_mode = "visitor_pick";
    block_id = null;
  } else {
    scope_mode = block_id ? "fixed_block" : "visitor_pick";
  }

  if (scope_mode === "fixed_block" && !block_id) {
    scope_mode = "visitor_pick";
  }

  return {
    allowed_products: allowed,
    timings: {
      drill_dialog,
      drill_solo,
      // Legacy mirrors so older UI/tests that read timed_* still work.
      timed_explore: drill_dialog,
      timed_drill: drill_solo,
    },
    block_id: scope_mode === "workspace" ? null : block_id,
    scope_mode,
  };
}

/** True when the portal forces entire-workspace practice (no block choice). */
export function isPracticePortalWorkspaceScope(
  config: PracticePortalConfig | null | undefined,
): boolean {
  return config?.scope_mode === "workspace";
}

/**
 * Products that can actually mint under the portal's scope.
 * Workspace-level force only supports Drill (TAP) products that allow null block_id;
 * Explore (ILE) requires a concrete block and is excluded from the public desk.
 */
export function practicePortalProductsForScope(
  config: PracticePortalConfig,
): PracticePortalProductId[] {
  const cfg = normalizePracticePortalConfig(config);
  if (cfg.scope_mode !== "workspace") return cfg.allowed_products;
  return cfg.allowed_products.filter((id) => !isExploreProduct(id));
}

/**
 * Resolve effective block for a mint.
 * - workspace scope: always null (visitor/fixed overrides ignored)
 * - fixed_block: config.block_id (visitor override ignored)
 * - visitor_pick: visitor request when present, else null
 */
export function resolvePracticePortalMintBlockId(
  config: PracticePortalConfig,
  requestBlockId: unknown,
): string | null {
  if (config.scope_mode === "workspace") {
    return null;
  }
  if (config.scope_mode === "fixed_block") {
    return config.block_id ?? null;
  }
  const fromRequest =
    typeof requestBlockId === "string" && requestBlockId.trim()
      ? requestBlockId.trim()
      : null;
  if (fromRequest) return fromRequest;
  return config.block_id ?? null;
}

export function isPracticePortalProductAllowed(
  config: PracticePortalConfig,
  productId: PracticePortalProductId | string | null | undefined,
): boolean {
  if (!productId) return false;
  const id = parsePracticePortalProductId(productId);
  if (!id) return false;
  return config.allowed_products.includes(id);
}

/**
 * Whether a duration is allowed for a product.
 * Explore (ILE) products always pass (minutes ignored).
 * Drill (TAP) products require minutes to be in the configured list.
 */
export function isPracticePortalTimingAllowed(
  config: PracticePortalConfig,
  productId: PracticePortalProductId | string | null | undefined,
  minutes: unknown,
): boolean {
  const id = parsePracticePortalProductId(productId);
  if (!id) return false;
  if (!isPracticePortalProductAllowed(config, id)) return false;
  if (isExploreProduct(id)) return true;

  const list =
    id === "drill_solo" ? config.timings.drill_solo : config.timings.drill_dialog;
  if (list.length === 0) return false;
  const n = typeof minutes === "number" ? minutes : Number(minutes);
  if (!Number.isFinite(n)) return false;
  return list.includes(Math.trunc(n));
}

/**
 * Validate a visitor mint request against a portal config.
 * Does not touch the database; block existence is checked by the API.
 */
export function validatePracticePortalMintRequest(
  config: PracticePortalConfig,
  body: PracticePortalMintRequest | null | undefined,
): PracticePortalMintValidation {
  const productId = parsePracticePortalProductId(body?.product_id);
  if (!productId) {
    return {
      ok: false,
      error: "product_id is required and must be a known product intent",
      code: "validation_error",
    };
  }

  if (!isPracticePortalProductAllowed(config, productId)) {
    return {
      ok: false,
      error: `Product "${productId}" is not enabled on this Practice Portal`,
      code: "product_not_allowed",
    };
  }

  const launch = launchTargetForPracticePortalProduct(productId);
  const block_id = resolvePracticePortalMintBlockId(config, body?.block_id);

  // Workspace-forced portals cannot mint Explore (ILE requires a block).
  if (config.scope_mode === "workspace" && isExploreProduct(productId)) {
    return {
      ok: false,
      error:
        "Explore products are not available on workspace-level Knowledge Portals (they require a practice block). Enable a Drill product or switch the portal off workspace scope.",
      code: "product_not_allowed",
    };
  }

  if (isExploreProduct(productId)) {
    if (!block_id) {
      return {
        ok: false,
        error:
          "block_id is required for Explore products (set a fixed block on the portal or pass block_id)",
        code: "block_required",
      };
    }
    return {
      ok: true,
      product_id: productId,
      minutes: null,
      launch,
      block_id,
    };
  }

  // Drill (TAP) products — workspace scope always yields block_id null (enforced above).
  const timingList =
    productId === "drill_solo"
      ? config.timings.drill_solo
      : config.timings.drill_dialog;
  const defaultMinutes =
    timingList[0] ??
    (productId === "drill_solo" ? 30 : TAP_LINK_DEFAULT_MINUTES);

  let minutes: number;
  if (body?.minutes === undefined || body?.minutes === null || body?.minutes === "") {
    minutes = defaultMinutes;
  } else {
    minutes = normalizeTapLinkMinutes(body.minutes, defaultMinutes);
  }

  if (!isPracticePortalTimingAllowed(config, productId, minutes)) {
    if (
      body?.minutes !== undefined &&
      body?.minutes !== null &&
      body?.minutes !== "" &&
      Number.isFinite(Number(body.minutes))
    ) {
      return {
        ok: false,
        error: `Duration ${Math.trunc(Number(body.minutes))} min is not enabled for ${productId}`,
        code: "timing_not_allowed",
      };
    }
    if (timingList.length === 0) {
      return {
        ok: false,
        error: `No timings configured for ${productId}`,
        code: "timing_not_allowed",
      };
    }
    return {
      ok: false,
      error: `Duration ${minutes} min is not enabled for ${productId}`,
      code: "timing_not_allowed",
    };
  }

  return {
    ok: true,
    product_id: productId,
    minutes,
    launch,
    block_id: config.scope_mode === "workspace" ? null : block_id,
  };
}

/**
 * Body fields for createWorkspaceTapLink / createWorkspaceIleLink from a validated mint.
 */
export function practicePortalMintToCreateFields(validated: Extract<
  PracticePortalMintValidation,
  { ok: true }
>): {
  linkKind: "ile" | "tap";
  body: Record<string, unknown>;
  blockId: string | null;
} {
  const fields = productIntentToCreateFields(validated.launch);
  if (fields.linkKind === "ile") {
    return {
      linkKind: "ile",
      blockId: validated.block_id,
      body: {
        participant_type: "anonymous",
        show_end_session: true,
        access_mode: "private",
        session_mode: fields.session_mode,
        project: fields.project === true,
      },
    };
  }
  return {
    linkKind: "tap",
    blockId: validated.block_id,
    body: {
      minutes: validated.minutes ?? TAP_LINK_DEFAULT_MINUTES,
      participant_type: "anonymous",
      post_session: "show_results",
      show_end_session: true,
      access_mode: "private",
      interaction_kind: fields.interaction_kind,
      exercise: fields.exercise === true,
    },
  };
}

/** Public path segment for Practice Portal share URLs (`/portal/{token}`). */
export const PRACTICE_PORTAL_PUBLIC_PATH = "portal" as const;

/** Public share URL for a Practice Portal bearer token. */
export function buildPracticePortalUrl(baseUrl: string, token: string): string {
  const base = (baseUrl || "").replace(/\/$/, "");
  const t = (token || "").trim();
  return `${base}/${PRACTICE_PORTAL_PUBLIC_PATH}/${t}`;
}

/**
 * Classify a portal-row lookup so UI/API can distinguish missing tokens from
 * storage/query failures (never map DB errors to “not found”).
 */
export type PracticePortalLookupClassification =
  | { outcome: "found"; status: string }
  | { outcome: "not_found" }
  | { outcome: "revoked"; status: string }
  | { outcome: "storage_error"; message: string };

export function classifyPracticePortalLookup(input: {
  data?: { status?: string | null } | null;
  error?: { message?: string | null } | null;
}): PracticePortalLookupClassification {
  if (input.error) {
    const message =
      typeof input.error.message === "string" && input.error.message.trim()
        ? input.error.message.trim()
        : "Failed to load Practice Portal";
    return { outcome: "storage_error", message };
  }
  if (!input.data) {
    return { outcome: "not_found" };
  }
  const status =
    typeof input.data.status === "string" ? input.data.status.trim() : "";
  if (status && status !== "active") {
    return { outcome: "revoked", status: status || "revoked" };
  }
  return { outcome: "found", status: status || "active" };
}

/**
 * Shape the public landing payload (products + timings only from config).
 * Pure — no DB.
 */
export function buildPracticePortalLandingView(input: {
  /** Raw or normalized portal config (normalized inside). */
  config: PracticePortalConfig | Record<string, unknown> | null | undefined;
  workspace: {
    id: string;
    title?: string | null;
    root_topic?: string | null;
  };
  blocks?: Array<{ id: string; title?: string | null; is_start?: boolean | null }>;
  portal_id?: string;
}): {
  portal_id: string | null;
  workspace: {
    id: string;
    title: string | null;
    root_topic: string | null;
  };
  config: PracticePortalConfig;
  /** Fixed block from portal config when set (visitor cannot change). */
  fixed_block_id: string | null;
  /**
   * When true, public desk forces workspace-level practice: no block picker
   * and no fixed-block chrome; mint always uses null block_id.
   */
  force_workspace_scope: boolean;
  scope_mode: PracticePortalScopeMode;
  products: Array<{
    id: PracticePortalProductId;
    launch: ProductLaunchTarget;
    timings: number[];
  }>;
  blocks: Array<{ id: string; title: string | null; is_start: boolean }>;
} {
  const config = normalizePracticePortalConfig(input.config);
  const productIds = practicePortalProductsForScope(config);
  const products = productIds.map((id) => {
    const launch = launchTargetForPracticePortalProduct(id);
    const timings =
      id === "drill_dialog"
        ? config.timings.drill_dialog
        : id === "drill_solo"
          ? config.timings.drill_solo
          : [];
    return { id, launch, timings };
  });

  const allBlocks = (input.blocks || []).map((b) => ({
    id: b.id,
    title: b.title ?? null,
    is_start: b.is_start === true,
  }));

  let blocks: Array<{ id: string; title: string | null; is_start: boolean }>;
  if (config.scope_mode === "workspace") {
    blocks = [];
  } else if (config.scope_mode === "fixed_block" && config.block_id != null) {
    blocks = allBlocks.filter((b) => b.id === config.block_id);
  } else {
    blocks = allBlocks;
  }

  return {
    portal_id: input.portal_id ?? null,
    workspace: {
      id: input.workspace.id,
      title: input.workspace.title ?? null,
      root_topic: input.workspace.root_topic ?? null,
    },
    config,
    fixed_block_id:
      config.scope_mode === "fixed_block" ? config.block_id : null,
    force_workspace_scope: config.scope_mode === "workspace",
    scope_mode: config.scope_mode,
    products,
    blocks,
  };
}

/** Re-export for callers that list all launch targets. */
export { allProductLaunchTargets, resolveProductIntent };
