/**
 * Dashboard Home public-map catalog: present, search by name+category,
 * and partition into hero / secondary / grid / AYCL paid.
 */

import {
  AYCL_SUGGESTED_CATEGORIES,
  formatAyclPriceCents,
  normalizeAyclCategory,
  resolveAyclCheckoutCents,
} from "@/lib/aycl-marketplace";
import {
  WORKSPACE_KIND_STANDARD,
  parseWorkspaceKind,
} from "@/lib/workspace-kind";

export { AYCL_SUGGESTED_CATEGORIES };

export const DASHBOARD_CATALOG_PATH = "/api/dashboard/catalog";
export const DASHBOARD_MAPS_ADD_PATH = "/api/dashboard/maps/add";
export const DASHBOARD_MAPS_TRY_PATH = "/api/dashboard/maps/try";
export const DASHBOARD_HOME_HERO_COUNT = 5;
export const DASHBOARD_HOME_SECONDARY_COUNT = 8;
export const PUBLIC_MAP_CARD_SUMMARY_MAX = 160;

export const PUBLISH_PLAY_COPY_MESSAGE =
  "Play copies cannot be listed on Home";

export type PublicMapCatalogRow = {
  id?: unknown;
  title?: unknown;
  root_topic?: unknown;
  description?: unknown;
  workspace_goal?: unknown;
  cover_image_url?: unknown;
  created_at?: unknown;
  is_public?: unknown;
  is_all_you_can_learn?: unknown;
  is_play_copy?: unknown;
  workspace_kind?: unknown;
  aycl_category?: unknown;
  aycl_summary?: unknown;
  aycl_full_price_cents?: unknown;
};

export type PublicMapCatalogItem = {
  id: string;
  title: string;
  category: string;
  summary: string | null;
  coverImageUrl: string | null;
  isAycl: boolean;
  priceLabel: string | null;
  createdAt: string | null;
};

export type PublicMapCatalogFilter = {
  query?: string | null;
  category?: string | null;
};

export type PublicMapCatalogPartition = {
  hero: PublicMapCatalogItem[];
  secondary: PublicMapCatalogItem[];
  grid: PublicMapCatalogItem[];
  ayclPaid: PublicMapCatalogItem[];
};

function clean(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

export function pickHomeMapTryBlock<
  T extends {
    id?: unknown;
    is_start?: unknown;
    position_x?: unknown;
    position_y?: unknown;
  },
>(blocks: readonly T[] | null | undefined): T | null {
  const rows = (blocks || []).filter((row) => String(row.id || "").trim());
  if (rows.length === 0) return null;
  const start = rows.find((row) => row.is_start === true);
  if (start) return start;
  return (
    [...rows].sort((a, b) => {
      const ay = Number(a.position_y) || 0;
      const by = Number(b.position_y) || 0;
      if (ay !== by) return ay - by;
      return (Number(a.position_x) || 0) - (Number(b.position_x) || 0);
    })[0] ?? null
  );
}

export function truncatePublicMapSummary(
  text: string | null | undefined,
  max = PUBLIC_MAP_CARD_SUMMARY_MAX,
): string {
  const value = clean(text);
  if (!value) return "";
  if (value.length <= max) return value;
  const sliced = value.slice(0, max);
  const cut = sliced.replace(/\s+\S*$/, "").trimEnd();
  return `${cut || sliced.trimEnd()}…`;
}

export function rejectPublishPlayCopy(input: {
  makingPublic: boolean;
  isPlayCopy: boolean;
}): string | null {
  if (!input.makingPublic) return null;
  if (!input.isPlayCopy) return null;
  return PUBLISH_PLAY_COPY_MESSAGE;
}

export function presentPublicMapCatalogItem(
  row: PublicMapCatalogRow | null | undefined,
): PublicMapCatalogItem | null {
  if (!row || row.is_public !== true) return null;
  if (row.is_play_copy === true) return null;
  if (parseWorkspaceKind(row.workspace_kind) !== WORKSPACE_KIND_STANDARD) return null;
  const id = clean(row.id);
  if (!id) return null;
  const category = normalizeAyclCategory(row.aycl_category) || "";
  const title = clean(row.title) || clean(row.root_topic) || "Map";
  const summary =
    clean(row.aycl_summary) ||
    clean(row.description) ||
    clean(row.workspace_goal) ||
    null;
  const isAycl = Boolean(row.is_all_you_can_learn);
  const priceLabel = isAycl
    ? formatAyclPriceCents(
        resolveAyclCheckoutCents("full", {
          aycl_full_price_cents:
            typeof row.aycl_full_price_cents === "number" ? row.aycl_full_price_cents : null,
        }),
      )
    : null;
  const createdAt = typeof row.created_at === "string" ? row.created_at : null;
  return {
    id,
    title,
    category,
    summary,
    coverImageUrl: clean(row.cover_image_url) || null,
    isAycl,
    priceLabel,
    createdAt,
  };
}

export function presentPublicMapCatalog(
  rows: readonly PublicMapCatalogRow[] | null | undefined,
): PublicMapCatalogItem[] {
  const items: PublicMapCatalogItem[] = [];
  for (const row of rows || []) {
    const item = presentPublicMapCatalogItem(row);
    if (item) items.push(item);
  }
  return sortPublicMapCatalog(items);
}

export function sortPublicMapCatalog(
  items: readonly PublicMapCatalogItem[],
): PublicMapCatalogItem[] {
  return [...items].sort((a, b) => {
    const aTime = Date.parse(a.createdAt || "") || 0;
    const bTime = Date.parse(b.createdAt || "") || 0;
    if (bTime !== aTime) return bTime - aTime;
    return a.title.localeCompare(b.title);
  });
}

export function filterPublicMapCatalog(
  items: readonly PublicMapCatalogItem[],
  filter: PublicMapCatalogFilter = {},
): PublicMapCatalogItem[] {
  const categoryNeedle = clean(filter.category).toLowerCase();
  const query = clean(filter.query).toLowerCase();
  const wantCategory =
    Boolean(categoryNeedle) &&
    categoryNeedle !== "all" &&
    categoryNeedle !== "all categories";

  return items.filter((item) => {
    if (wantCategory && item.category.toLowerCase() !== categoryNeedle) {
      return false;
    }
    if (!query) return true;
    const hay = `${item.title} ${item.category} ${item.summary || ""}`.toLowerCase();
    return hay.includes(query);
  });
}

export function collectPublicMapCategories(
  items: readonly PublicMapCatalogItem[],
): string[] {
  const set = new Set<string>();
  for (const item of items) {
    if (item.category) set.add(item.category);
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

export function partitionPublicMapCatalog(
  items: readonly PublicMapCatalogItem[],
): PublicMapCatalogPartition {
  const sorted = sortPublicMapCatalog(items);
  const hero = sorted.slice(0, DASHBOARD_HOME_HERO_COUNT);
  const secondary = sorted.slice(
    DASHBOARD_HOME_HERO_COUNT,
    DASHBOARD_HOME_HERO_COUNT + DASHBOARD_HOME_SECONDARY_COUNT,
  );
  const grid = sorted.slice(
    DASHBOARD_HOME_HERO_COUNT + DASHBOARD_HOME_SECONDARY_COUNT,
  );
  return {
    hero,
    secondary,
    grid,
    ayclPaid: sorted.filter((item) => item.isAycl),
  };
}
