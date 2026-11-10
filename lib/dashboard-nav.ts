/**
 * Dashboard platform navigation: sidebar sections, query-tab parsing,
 * and product create deep-links.
 */

import {
  productFlowNewPath,
  productRegionNewPath,
  type ProductFlowKind,
} from "@/lib/product-flow";

export const DASHBOARD_TABS = [
  "home",
  "practice",
  "practice_performance",
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
  "sessions",
  "config",
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export type DashboardProductTab = "verification" | "calibration" | "solve";

export type DashboardRegionsTab =
  | "verification_regions"
  | "calibration_regions"
  | "solve_regions";

export type DashboardStudioTab =
  | "verification_studio"
  | "calibration_studio"
  | "solve_studio";

export type DashboardNavItem = {
  id: string;
  label: string;
  /** Off-dashboard destination. Tab items omit this. */
  href?: string;
  /** Consecutive items that share a cluster render as an untitled subgroup. */
  cluster?: string;
};

export type DashboardNavGroupId =
  | "verification"
  | "calibration"
  | "solve"
  | "account";

export type DashboardNavGroup = {
  id: DashboardNavGroupId;
  label: string;
  items: readonly DashboardNavItem[];
};

export const DASHBOARD_HOME_NAV_ITEM: DashboardNavItem = {
  id: "home",
  label: "Home",
};

export const DASHBOARD_PRACTICE_NAV_ITEM: DashboardNavItem = {
  id: "practice",
  label: "Browse Problems",
};

export const DASHBOARD_PERFORMANCE_NAV_ITEM: DashboardNavItem = {
  id: "practice_performance",
  label: "Performance",
};

export const DASHBOARD_TOP_NAV_ITEMS: readonly DashboardNavItem[] = [
  DASHBOARD_HOME_NAV_ITEM,
  DASHBOARD_PRACTICE_NAV_ITEM,
  DASHBOARD_PERFORMANCE_NAV_ITEM,
];

export const DASHBOARD_NAV_GROUPS: readonly DashboardNavGroup[] = [
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
] as const;

const TAB_SET = new Set<string>(DASHBOARD_TABS);

const RETIRED_TAB_ALIASES = new Set([
  "browse_maps",
  "my_maps",
  "learning",
  "shop",
  "help",
  "plans",
  "learning_studio",
]);

export function isDashboardTab(value: unknown): value is DashboardTab {
  return typeof value === "string" && TAB_SET.has(value);
}

export function isDashboardProductTab(value: unknown): value is DashboardProductTab {
  return value === "verification" || value === "calibration" || value === "solve";
}

export function isDashboardShopTab(value: unknown): value is never {
  return false;
}

export function isDashboardMyMapsTab(value: unknown): value is never {
  return false;
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
    value === "verification_studio" ||
    value === "calibration_studio" ||
    value === "solve_studio"
  );
}

export function isDashboardBrowseMapsTab(value: unknown): value is never {
  return false;
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
): DashboardProductTab | null {
  if (tab === "verification_studio") return "verification";
  if (tab === "calibration_studio") return "calibration";
  if (tab === "solve_studio") return "solve";
  return null;
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

/** Query `tab` → sidebar section. Retired map/shop/help tabs land on Home. */
export function parseDashboardTab(value: unknown): DashboardTab {
  if (value === "upgrade") return "usage";
  if (value === "practice_studio") return "solve_studio";
  if (typeof value === "string" && RETIRED_TAB_ALIASES.has(value)) return "home";
  if (isDashboardTab(value)) return value;
  return "home";
}

export function dashboardTypeFilterForTab(
  tab: DashboardTab,
): DashboardProductTab | null {
  if (tab === "verification" || tab === "verification_regions" || tab === "verification_studio") {
    return "verification";
  }
  if (tab === "calibration" || tab === "calibration_regions" || tab === "calibration_studio") {
    return "calibration";
  }
  if (
    tab === "solve" ||
    tab === "solve_regions" ||
    tab === "solve_studio" ||
    tab === "practice" ||
    tab === "practice_performance"
  ) {
    return "solve";
  }
  return null;
}

export function dashboardListFilterForTab(_tab: DashboardTab): null {
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
  return productFlowNewPath("solve");
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
  return productRegionNewPath("solve");
}

export function dashboardCreateMode(_tab: DashboardProductTab): null {
  return null;
}

export function dashboardProductLabel(tab: DashboardProductTab): string {
  if (tab === "verification") return "Verification";
  if (tab === "calibration") return "Calibration";
  return "Solve";
}

export function dashboardCreateLabel(tab: DashboardProductTab): string {
  return `Create ${dashboardProductLabel(tab)} flow →`;
}

export type DashboardPracticeCreateFlowCta = {
  id: DashboardProductTab;
  label: string;
  href: string;
};

export function dashboardPracticeCreateFlowCtas(): readonly DashboardPracticeCreateFlowCta[] {
  return [
    {
      id: "solve",
      label: "Create Solve / Practice flow",
      href: dashboardCreateHref("solve"),
    },
    {
      id: "verification",
      label: "Create Verify flow",
      href: dashboardCreateHref("verification"),
    },
    {
      id: "calibration",
      label: "Create Calibrate flow",
      href: dashboardCreateHref("calibration"),
    },
  ];
}

export function dashboardFrameLabel(tab: DashboardTab): string {
  if (tab === "practice") return "Browse Problems";
  if (tab === "practice_performance") return "Performance";
  if (isDashboardRegionsTab(tab)) return "Knowledge regions";
  if (isDashboardStudioTab(tab)) return "Data Studio";
  if (isDashboardProductTab(tab)) return dashboardProductLabel(tab);
  if (tab === "organization") return "Organization";
  if (tab === "integrations") return "Integrations";
  if (tab === "usage") return "Usage";
  if (tab === "sessions") return "Sessions";
  if (tab === "config") return "Config";
  return "Home";
}
