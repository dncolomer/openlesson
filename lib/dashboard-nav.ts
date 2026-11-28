/**
 * Dashboard platform navigation: sidebar sections, query-tab parsing,
 * and product create deep-links.
 */

import { productFlowNewPath, productRegionNewPath } from "@/lib/product-flow";

export const DASHBOARD_TABS = [
  "home",
  "protocols",
  "regions",
  "usage",
  "organization",
  "protocol_settings",
  "integrations",
  "config",
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export type DashboardProductTab = "protocol";

export type DashboardRegionsTab = "regions";

export type DashboardNavItem = {
  id: string;
  label: string;
  /** Off-dashboard destination. Tab items omit this. */
  href?: string;
  /** Consecutive items that share a cluster render as an untitled subgroup. */
  cluster?: string;
};

export type DashboardNavGroupId = "account";

export type DashboardNavGroup = {
  id: DashboardNavGroupId;
  label: string;
  items: readonly DashboardNavItem[];
};

export const DASHBOARD_HOME_NAV_ITEM: DashboardNavItem = {
  id: "home",
  label: "Home",
};

export const DASHBOARD_TOP_NAV_ITEMS: readonly DashboardNavItem[] = [
  DASHBOARD_HOME_NAV_ITEM,
  { id: "protocols", label: "Protocols" },
  { id: "regions", label: "Knowledge Regions" },
];

export const DASHBOARD_NAV_GROUPS: readonly DashboardNavGroup[] = [
  {
    id: "account",
    label: "Account",
    items: [
      { id: "usage", label: "Usage" },
      { id: "organization", label: "Organization" },
      { id: "protocol_settings", label: "Protocol Settings" },
      { id: "integrations", label: "Integrations" },
    ],
  },
] as const;

const TAB_SET = new Set<string>(DASHBOARD_TABS);

export function isDashboardTab(value: unknown): value is DashboardTab {
  return typeof value === "string" && TAB_SET.has(value);
}

export function isDashboardProductTab(value: unknown): value is DashboardProductTab {
  return value === "protocol";
}

export function isDashboardRegionsTab(value: unknown): value is DashboardRegionsTab {
  return value === "regions";
}

export function dashboardNavGroupIdForTab(
  tab: DashboardTab,
): DashboardNavGroupId | null {
  for (const group of DASHBOARD_NAV_GROUPS) {
    if (group.items.some((item) => item.id === tab)) return group.id;
  }
  return null;
}

export function clusterDashboardNavItems(
  items: readonly DashboardNavItem[],
): DashboardNavItem[][] {
  const clusters: DashboardNavItem[][] = [];
  for (const item of items) {
    const key = item.cluster ?? "";
    const last = clusters[clusters.length - 1];
    const lastKey = last?.[0]?.cluster ?? "";
    if (!last || lastKey !== key) {
      clusters.push([item]);
    } else {
      last.push(item);
    }
  }
  return clusters;
}

export function isDashboardNavTabItem(
  item: DashboardNavItem,
): item is DashboardNavItem & { id: DashboardTab; href?: undefined } {
  return !item.href && isDashboardTab(item.id);
}

/** Query `tab` → sidebar section. Unknown values land on Home. */
export function parseDashboardTab(value: unknown): DashboardTab {
  if (isDashboardTab(value)) return value;
  return "home";
}

export function dashboardHrefForTab(tab: DashboardTab): string {
  return tab === "home" ? "/dashboard" : `/dashboard?tab=${tab}`;
}

export function dashboardProtocolSettingsHref(settingId?: string | null): string {
  const id = String(settingId || "").trim();
  if (!id) return dashboardHrefForTab("protocol_settings");
  return `/dashboard?tab=protocol_settings&setting=${encodeURIComponent(id)}`;
}

export function dashboardTabForProductSurface(
  _kind?: unknown,
  area: "flow" | "region" | "protocol" = "flow",
): DashboardTab {
  return area === "region" ? "regions" : "protocols";
}

export function dashboardCreateHref(_kind?: DashboardProductTab | null): string {
  return productFlowNewPath();
}

export function dashboardRegionCreateHref(
  _kind?: DashboardProductTab | DashboardRegionsTab | null,
): string {
  return productRegionNewPath();
}

export function dashboardCreateMode(_tab: DashboardProductTab): null {
  return null;
}

export function dashboardProductLabel(_tab?: DashboardProductTab): string {
  return "Protocol";
}

export function dashboardCreateLabel(_kind?: DashboardProductTab | null): string {
  return "Create protocol →";
}

export function dashboardFrameLabel(tab: DashboardTab): string {
  if (tab === "protocols") return "Protocols";
  if (tab === "regions") return "Knowledge Regions";
  if (tab === "organization") return "Organization";
  if (tab === "protocol_settings") return "Protocol Settings";
  if (tab === "integrations") return "Integrations";
  if (tab === "usage") return "Usage";
  if (tab === "config") return "Config";
  return "Home";
}
