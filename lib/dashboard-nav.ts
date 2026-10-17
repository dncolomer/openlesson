/**
 * Dashboard platform navigation: sidebar sections, query-tab parsing,
 * and product create deep-links.
 */

import type {
  DashboardWorkspaceListFilter,
  DashboardWorkspaceTypeFilter,
} from "@/lib/dashboard-workspace-filters";
import type { WorkspaceCreateMode } from "@/lib/workspace-create-modes";

export const DASHBOARD_TABS = [
  "home",
  "learning",
  "shop",
  "verification",
  "verification_regions",
  "calibration",
  "calibration_regions",
  "usage",
  "upgrade",
  "organization",
  "integrations",
  "help",
  "sessions",
  "config",
] as const;

export type DashboardTab = (typeof DASHBOARD_TABS)[number];

export type DashboardProductTab = "learning" | "verification" | "calibration";

export type DashboardRegionsTab = "verification_regions" | "calibration_regions";

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
      { id: "learning", label: "Workspaces" },
      { id: "shop", label: "Your Shop" },
    ],
  },
  {
    id: "verification",
    label: "Verification",
    items: [
      { id: "verification", label: "Workspaces" },
      { id: "verification_regions", label: "Knowledge regions" },
    ],
  },
  {
    id: "calibration",
    label: "Calibration",
    items: [
      { id: "calibration", label: "Workspaces" },
      { id: "calibration_regions", label: "Knowledge regions" },
    ],
  },
  {
    id: "account",
    label: "Account",
    items: [
      { id: "usage", label: "Usage" },
      { id: "upgrade", label: "Upgrade" },
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
  return value === "learning" || value === "verification" || value === "calibration";
}

export function isDashboardShopTab(value: unknown): value is "shop" {
  return value === "shop";
}

export function isDashboardRegionsTab(value: unknown): value is DashboardRegionsTab {
  return value === "verification_regions" || value === "calibration_regions";
}

export function dashboardRegionsProduct(
  tab: DashboardTab,
): DashboardProductTab | null {
  if (tab === "verification_regions") return "verification";
  if (tab === "calibration_regions") return "calibration";
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
  if (isDashboardTab(value)) return value;
  return "home";
}

export function dashboardTypeFilterForTab(
  tab: DashboardTab,
): DashboardWorkspaceTypeFilter | null {
  if (tab === "learning" || tab === "shop") return "learning";
  if (tab === "verification" || tab === "verification_regions") return "verification";
  if (tab === "calibration" || tab === "calibration_regions") return "calibration";
  return null;
}

export function dashboardListFilterForTab(
  tab: DashboardTab,
): DashboardWorkspaceListFilter | null {
  if (tab === "shop") return "aycl";
  return null;
}

export function dashboardCreateHref(tab: DashboardProductTab): string {
  if (tab === "verification") return "/workspace/new?mode=knowledge_region";
  if (tab === "calibration") return "/workspace/new?mode=calibration";
  return "/workspace/new";
}

export function dashboardCreateMode(tab: DashboardProductTab): WorkspaceCreateMode | null {
  if (tab === "verification") return "knowledge_region";
  if (tab === "calibration") return "calibration";
  return null;
}

export function dashboardProductLabel(tab: DashboardProductTab): string {
  if (tab === "verification") return "Verification";
  if (tab === "calibration") return "Calibration";
  return "Learning";
}

export function dashboardFrameLabel(tab: DashboardTab): string {
  if (tab === "shop") return "Your Shop";
  if (isDashboardRegionsTab(tab)) return "Knowledge regions";
  if (isDashboardProductTab(tab)) return dashboardProductLabel(tab);
  if (tab === "help") return "How it works";
  if (tab === "organization") return "Organization";
  if (tab === "integrations") return "Integrations";
  if (tab === "usage") return "Usage";
  if (tab === "upgrade") return "Upgrade";
  if (tab === "sessions") return "Sessions";
  if (tab === "config") return "Config";
  return "Home";
}
