/**
 * Practice Portal — workspace-scoped guest mint desk.
 *
 * Owners configure which product intents and timings a shareable portal
 * may offer; visitors open the portal URL and mint a one-shot TAP/ILE
 * guest link without needing the map catalog or public workspace.
 *
 * Pure helpers live here so unit tests do not need Supabase/API I/O.
 */

import {
  allProductLaunchTargets,
  productIntentToCreateFields,
  resolveProductIntent,
  type ProductLaunchTarget,
} from "@/lib/product-intent";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
  normalizeTapLinkMinutes,
} from "@/lib/pow-api/tap-link-config";

/** Product intents a portal may enable (Explore/Drill × Open-ended/Timed). */
export const PRACTICE_PORTAL_PRODUCT_IDS = [
  "open_ended_explore",
  "open_ended_drill",
  "timed_explore",
  "timed_drill",
] as const;

export type PracticePortalProductId = (typeof PRACTICE_PORTAL_PRODUCT_IDS)[number];

/** Duration choices offered when configuring Timed Exploration (minutes). */
export const PRACTICE_PORTAL_TIMED_EXPLORE_OPTIONS = [5, 10, 15, 30, 45, 60] as const;

/** Duration choices offered when configuring Timed Drill (minutes). */
export const PRACTICE_PORTAL_TIMED_DRILL_OPTIONS = [15, 30, 45, 60, 90] as const;

/** Default Timed Exploration minutes when a portal enables that product without timings. */
export const PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES: readonly number[] = [5, 10, 30];

/** Default Timed Drill minutes when a portal enables that product without timings. */
export const PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES: readonly number[] = [15, 30, 45];

export type PracticePortalTimings = {
  timed_explore: number[];
  timed_drill: number[];
};

export type PracticePortalConfig = {
  allowed_products: PracticePortalProductId[];
  timings: PracticePortalTimings;
  /**
   * Optional fixed workspace block for this portal.
   * When set, open-ended mints use it without a visitor block pick;
   * timed mints also default to this block when provided.
   */
  block_id: string | null;
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

function isTimedProduct(id: PracticePortalProductId): boolean {
  return id === "timed_explore" || id === "timed_drill";
}

function isOpenEndedProduct(id: PracticePortalProductId): boolean {
  return id === "open_ended_explore" || id === "open_ended_drill";
}

/** Map product intent id → ProductLaunchTarget via shipped resolveProductIntent. */
export function launchTargetForPracticePortalProduct(
  productId: PracticePortalProductId,
): ProductLaunchTarget {
  switch (productId) {
    case "open_ended_explore":
      return resolveProductIntent("explore", "open_ended");
    case "open_ended_drill":
      return resolveProductIntent("drill", "open_ended");
    case "timed_explore":
      return resolveProductIntent("explore", "timed");
    case "timed_drill":
      return resolveProductIntent("drill", "timed");
    default:
      return resolveProductIntent("explore", "open_ended");
  }
}

export function parsePracticePortalProductId(value: unknown): PracticePortalProductId | null {
  if (typeof value !== "string") return null;
  const raw = value.trim().toLowerCase();
  if (PRODUCT_ID_SET.has(raw)) return raw as PracticePortalProductId;
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

/**
 * Normalize raw create/config JSON into a durable portal config.
 * - Invalid product ids are dropped.
 * - Empty/missing allowed_products → all four products.
 * - Timed products without timings get map-aligned defaults.
 * - Timings for disabled timed products are cleared.
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

  const timedExploreAllowed = allowed.includes("timed_explore");
  const timedDrillAllowed = allowed.includes("timed_drill");

  const timed_explore = timedExploreAllowed
    ? clampMinutesList(
        timingsRaw.timed_explore ?? timingsRaw.timedExplore,
        PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
      )
    : [];

  const timed_drill = timedDrillAllowed
    ? clampMinutesList(
        timingsRaw.timed_drill ?? timingsRaw.timedDrill,
        PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
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
  const block_id = blockRaw.trim() || null;

  return {
    allowed_products: allowed,
    timings: { timed_explore, timed_drill },
    block_id,
  };
}

/** Resolve effective block for a mint: visitor override wins when present, else fixed config. */
export function resolvePracticePortalMintBlockId(
  config: PracticePortalConfig,
  requestBlockId: unknown,
): string | null {
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
 * Open-ended products always pass (minutes ignored).
 * Timed products require minutes to be in the configured list.
 */
export function isPracticePortalTimingAllowed(
  config: PracticePortalConfig,
  productId: PracticePortalProductId | string | null | undefined,
  minutes: unknown,
): boolean {
  const id = parsePracticePortalProductId(productId);
  if (!id) return false;
  if (!isPracticePortalProductAllowed(config, id)) return false;
  if (isOpenEndedProduct(id)) return true;

  const list =
    id === "timed_drill" ? config.timings.timed_drill : config.timings.timed_explore;
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

  if (isOpenEndedProduct(productId)) {
    if (!block_id) {
      return {
        ok: false,
        error:
          "block_id is required for open-ended products (set a fixed block on the portal or pass block_id)",
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

  // Timed products
  const timingList =
    productId === "timed_drill"
      ? config.timings.timed_drill
      : config.timings.timed_explore;
  const defaultMinutes =
    timingList[0] ??
    (productId === "timed_drill" ? 30 : TAP_LINK_DEFAULT_MINUTES);

  let minutes: number;
  if (body?.minutes === undefined || body?.minutes === null || body?.minutes === "") {
    minutes = defaultMinutes;
  } else {
    minutes = normalizeTapLinkMinutes(body.minutes, defaultMinutes);
  }

  if (!isPracticePortalTimingAllowed(config, productId, minutes)) {
    // If caller sent an explicit value not in list, refuse; if list empty, refuse.
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
    // No explicit minutes and empty timing list
    if (timingList.length === 0) {
      return {
        ok: false,
        error: `No timings configured for ${productId}`,
        code: "timing_not_allowed",
      };
    }
    // normalize may have drifted outside list — refuse
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
    block_id,
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
  config: PracticePortalConfig;
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
  products: Array<{
    id: PracticePortalProductId;
    launch: ProductLaunchTarget;
    timings: number[];
  }>;
  blocks: Array<{ id: string; title: string | null; is_start: boolean }>;
} {
  const config = normalizePracticePortalConfig(input.config);
  const products = config.allowed_products.map((id) => {
    const launch = launchTargetForPracticePortalProduct(id);
    const timings =
      id === "timed_explore"
        ? config.timings.timed_explore
        : id === "timed_drill"
          ? config.timings.timed_drill
          : [];
    return { id, launch, timings };
  });

  const allBlocks = (input.blocks || []).map((b) => ({
    id: b.id,
    title: b.title ?? null,
    is_start: b.is_start === true,
  }));
  // When a fixed block is configured, only surface that block (if present).
  const blocks =
    config.block_id != null
      ? allBlocks.filter((b) => b.id === config.block_id)
      : allBlocks;


  return {
    portal_id: input.portal_id ?? null,
    workspace: {
      id: input.workspace.id,
      title: input.workspace.title ?? null,
      root_topic: input.workspace.root_topic ?? null,
    },
    config,
    fixed_block_id: config.block_id,
    products,
    blocks,
  };
}

/** All product launch targets that a portal can expose (UI order). */
export function practicePortalAllLaunchTargets(): ProductLaunchTarget[] {
  return allProductLaunchTargets();
}

export function isPracticePortalTimedProduct(
  productId: PracticePortalProductId | string | null | undefined,
): boolean {
  const id = parsePracticePortalProductId(productId);
  return id ? isTimedProduct(id) : false;
}

export function isPracticePortalOpenEndedProduct(
  productId: PracticePortalProductId | string | null | undefined,
): boolean {
  const id = parsePracticePortalProductId(productId);
  return id ? isOpenEndedProduct(id) : false;
}
