/**
 * Dashboard platform navigation: sidebar sections, query-tab parsing,
 * and product create deep-links.
 */

import type {
  DashboardWorkspaceListFilter,
  DashboardWorkspaceTypeFilter,
} from "@/lib/dashboard-workspace-filters";
import {
  productFlowNewPath,
  productRegionNewPath,
  type ProductFlowKind,
} from "@/lib/product-flow";
import type { WorkspaceCreateMode } from "@/lib/workspace-create-modes";

export const DASHBOARD_TABS = [
  "home",
  "browse_maps",
  "practice",
  "practice_studio",
  "practice_performance",
  "my_maps",
  "learning",
  "learning_studio",
  "shop",
  "verification",
  "verification_regions",
  "verification_studio",
  "calibration",
  "calibration_regions",
  "calibration_studio",
  "solve",
  "solve_regions",
  "solve_studio",
  "usage",
  "organization",
  "integrations",
  "help",
  "sessions",
  "config",
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export type DashboardProductTab = "learning" | "verification" | "calibration" | "solve";

export type DashboardRegionsTab =
  | "verification_regions"
  | "calibration_regions"
  | "solve_regions";

export type DashboardStudioTab =
  | "learning_studio"
  | "verification_studio"
  | "calibration_studio"
  | "solve_studio"
  | "practice_studio";

export type DashboardNavItem = {
  id: string;
  label: string;
  /** Off-dashboard destination. Tab items omit this. */
  href?: string;
};

export type DashboardNavGroupId =
  | "platform"
  | "learning"
  | "verification"
  | "calibration"
  | "solve"
  | "account"
  | "support";

export type DashboardNavGroup = {
  id: DashboardNavGroupId;
  label: string;
  items: readonly DashboardNavItem[];
};

export const DASHBOARD_NAV_GROUPS: readonly DashboardNavGroup[] = [
  {
    id: "platform",
    label: "Platform",
    items: [{ id: "home", label: "Home" }],
  },
  {
    id: "learning",
    label: "Learning",
    items: [
      { id: "browse_maps", label: "Browse maps" },
      { id: "practice", label: "Browse exercises" },
      { id: "practice_studio", label: "Data Studio" },
      { id: "practice_performance", label: "Performance" },
      { id: "my_maps", label: "My Maps" },
      { id: "learning", label: "Build" },
      { id: "shop", label: "My Shop" },
    ],
  },
  {
    id: "solve",
    label: "Solve",
    items: [
      { id: "solve", label: "Flows" },
      { id: "solve_regions", label: "Knowledge regions" },
      { id: "solve_studio", label: "Data Studio" },
    ],
  },
  {
    id: "verification",
    label: "Verification",
    items: [
      { id: "verification", label: "Flows" },
      { id: "verification_regions", label: "Knowledge regions" },
      { id: "verification_studio", label: "Data Studio" },
    ],
  },
  {
    id: "calibration",
    label: "Calibration",
    items: [
      { id: "calibration", label: "Flows" },
      { id: "calibration_regions", label: "Knowledge regions" },
      { id: "calibration_studio", label: "Data Studio" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { id: "usage", label: "Usage" },
      { id: "organization", label: "Organization" },
      { id: "integrations", label: "Integrations" },
    ],
  },
  {
    id: "support",
    label: "Support",
    items: [{ id: "help", label: "How it works" }],
  },
] as const;

const TAB_SET = new Set<string>(DASHBOARD_TABS);

export function isDashboardTab(value: unknown): value is DashboardTab {
  return typeof value === "string" && TAB_SET.has(value);
}

export function isDashboardProductTab(value: unknown): value is DashboardProductTab {
  return (
    value === "learning" ||
    value === "verification" ||
    value === "calibration" ||
    value === "solve"
  );
}

export function isDashboardShopTab(value: unknown): value is "shop" {
  return value === "shop";
}

export function isDashboardMyMapsTab(value: unknown): value is "my_maps" {
  return value === "my_maps";
}

export function isDashboardRegionsTab(value: unknown): value is DashboardRegionsTab {
  return (
    value === "verification_regions" ||
    value === "calibration_regions" ||
    value === "solve_regions"
  );
}

export function isDashboardStudioTab(value: unknown): value is DashboardStudioTab {
  return (
    value === "learning_studio" ||
    value === "verification_studio" ||
    value === "calibration_studio" ||
    value === "solve_studio" ||
    value === "practice_studio"
  );
}

export function isDashboardBrowseMapsTab(value: unknown): value is "browse_maps" {
  return value === "browse_maps";
}

export function isDashboardPracticeTab(value: unknown): value is "practice" {
  return value === "practice";
}

export function isDashboardPracticePerformanceTab(
  value: unknown,
): value is "practice_performance" {
  return value === "practice_performance";
}

export function dashboardStudioProduct(
  tab: DashboardTab,
): DashboardProductTab | "practice" | null {
  if (tab === "learning_studio") return "learning";
  if (tab === "verification_studio") return "verification";
  if (tab === "calibration_studio") return "calibration";
  if (tab === "solve_studio") return "solve";
  if (tab === "practice_studio") return "practice";
  return null;
}

export function dashboardNavGroupIdForTab(tab: DashboardTab): DashboardNavGroupId {
  for (const group of DASHBOARD_NAV_GROUPS) {
    if (group.items.some((item) => item.id === tab)) return group.id;
  }
  return "platform";
}

export function dashboardRegionsProduct(
  tab: DashboardTab,
): DashboardProductTab | null {
  if (tab === "verification_regions") return "verification";
  if (tab === "calibration_regions") return "calibration";
  if (tab === "solve_regions") return "solve";
  return null;
}

export function isDashboardNavTabItem(
  item: DashboardNavItem,
): item is DashboardNavItem & { id: DashboardTab; href?: undefined } {
  return !item.href && isDashboardTab(item.id);
}

/** Query `tab` → sidebar section. `plans` is the old Workspaces tab. */
export function parseDashboardTab(value: unknown): DashboardTab {
  if (value === "plans") return "learning";
  if (value === "upgrade") return "usage";
  if (isDashboardTab(value)) return value;
  return "home";
}

export function dashboardTypeFilterForTab(
  tab: DashboardTab,
): DashboardWorkspaceTypeFilter | null {
  if (
    tab === "learning" ||
    tab === "shop" ||
    tab === "my_maps" ||
    tab === "learning_studio" ||
    tab === "browse_maps" ||
    tab === "practice" ||
    tab === "practice_studio" ||
    tab === "practice_performance"
  ) {
    return "learning";
  }
  if (tab === "verification" || tab === "verification_regions" || tab === "verification_studio") {
    return "verification";
  }
  if (tab === "calibration" || tab === "calibration_regions" || tab === "calibration_studio") {
    return "calibration";
  }
  if (tab === "solve" || tab === "solve_regions" || tab === "solve_studio") {
    return "solve";
  }
  return null;
}

export function dashboardListFilterForTab(
  tab: DashboardTab,
): DashboardWorkspaceListFilter | null {
  if (tab === "shop") return "aycl";
  return null;
}

export function dashboardHrefForTab(tab: DashboardTab): string {
  return tab === "home" ? "/dashboard" : `/dashboard?tab=${tab}`;
}

export function dashboardTabForProductSurface(
  kind: ProductFlowKind,
  area: "flow" | "region" = "flow",
): DashboardTab {
  if (area === "region") {
    if (kind === "calibration") return "calibration_regions";
    if (kind === "solve") return "solve_regions";
    return "verification_regions";
  }
  return kind;
}

export function dashboardCreateHref(tab: DashboardProductTab): string {
  if (tab === "verification") return productFlowNewPath("verification");
  if (tab === "calibration") return productFlowNewPath("calibration");
  if (tab === "solve") return productFlowNewPath("solve");
  return "/workspace/new";
}

export function dashboardRegionCreateHref(
  tab: DashboardProductTab | DashboardRegionsTab,
): string {
  if (tab === "calibration" || tab === "calibration_regions") {
    return productRegionNewPath("calibration");
  }
  if (tab === "verification" || tab === "verification_regions") {
    return productRegionNewPath("verification");
  }
  if (tab === "solve" || tab === "solve_regions") {
    return productRegionNewPath("solve");
  }
  return "/workspace/new";
}

export function dashboardCreateMode(tab: DashboardProductTab): WorkspaceCreateMode | null {
  if (tab === "learning") return null;
  return null;
}

export function dashboardProductLabel(tab: DashboardProductTab): string {
  if (tab === "verification") return "Verification";
  if (tab === "calibration") return "Calibration";
  if (tab === "solve") return "Solve";
  return "Learning";
}

export function dashboardCreateLabel(tab: DashboardProductTab): string {
  if (tab === "learning") return "Create a Learning Map →";
  return `Create ${dashboardProductLabel(tab)} flow →`;
}

export function dashboardFrameLabel(tab: DashboardTab): string {
  if (tab === "browse_maps") return "Browse maps";
  if (tab === "practice") return "Practice library";
  if (tab === "practice_performance") return "Performance";
  if (tab === "my_maps") return "My Maps";
  if (tab === "shop") return "My Shop";
  if (isDashboardRegionsTab(tab)) return "Knowledge regions";
  if (isDashboardStudioTab(tab)) return "Data Studio";
  if (isDashboardProductTab(tab)) return dashboardProductLabel(tab);
  if (tab === "help") return "How it works";
  if (tab === "organization") return "Organization";
  if (tab === "integrations") return "Integrations";
  if (tab === "usage") return "Usage";
  if (tab === "sessions") return "Sessions";
  if (tab === "config") return "Config";
  return "Home";
}
