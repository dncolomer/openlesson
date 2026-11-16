/**
 * Compact Home overview: Flows and Knowledge regions.
 */

import { dashboardHrefForTab, type DashboardTab } from "@/lib/dashboard-nav";
import { USE_CASES } from "@/lib/marketing/use-cases";

/** Home boxes reuse the use-cases stills. */
export const DASHBOARD_HOME_CTA_USE_CASE_IDS = {
  flows: "research-ai",
  regions: "team-insight",
} as const;

export type DashboardHomeCtaLink = {
  id: DashboardTab;
  label: string;
  href: string;
};

export type DashboardHomeCta = {
  id: DashboardTab;
  label: string;
  href: string;
  body: string;
  imageSrc: string;
  imageAlt: string;
  imageFit: "contain" | "cover";
  links: readonly DashboardHomeCtaLink[];
};

function surfaceLink(tab: DashboardTab, label: string): DashboardHomeCtaLink {
  return {
    id: tab,
    label,
    href: dashboardHrefForTab(tab),
  };
}

function useCaseVisual(id: (typeof USE_CASES)[number]["id"]): {
  imageSrc: string;
  imageAlt: string;
  imageFit: "contain" | "cover";
} {
  const item = USE_CASES.find((row) => row.id === id);
  if (!item) {
    throw new Error(`Missing use case ${id}`);
  }
  return {
    imageSrc: item.imageSrc,
    imageAlt: item.imageAlt,
    imageFit: item.imageFit,
  };
}

export type DashboardHomeIntegrationsCta = {
  id: "integrations";
  label: string;
  href: string;
  eyebrow: string;
  body: string;
  action: string;
};

export function dashboardHomeIntegrationsCta(): DashboardHomeIntegrationsCta {
  return {
    id: "integrations",
    label: "Integrations",
    href: dashboardHrefForTab("integrations"),
    eyebrow: "Quick access",
    body: "Connect agents with skill.md, MCP, and API keys.",
    action: "Open integrations →",
  };
}

export function dashboardHomeCtas(): DashboardHomeCta[] {
  const flows = surfaceLink("flows", "Open flows");
  const regions = surfaceLink("regions", "Open regions");
  return [
    {
      id: "flows",
      label: "Flows",
      href: flows.href,
      body: "Author Solve, Verification, and Calibration flows. Pick the type when you create one.",
      ...useCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.flows),
      links: [flows],
    },
    {
      id: "regions",
      label: "Knowledge regions",
      href: regions.href,
      body: "Simulate exploration strategies on your flows and inspect the resulting regions.",
      ...useCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.regions),
      links: [regions],
    },
  ];
}
