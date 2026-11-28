/**
 * Compact Home overview: Protocols and Knowledge regions.
 */

import { dashboardHrefForTab, type DashboardTab } from "@/lib/dashboard-nav";
import { USE_CASES } from "@/lib/marketing/use-cases";

/** Home boxes reuse the use-cases stills. */
export const DASHBOARD_HOME_CTA_USE_CASE_IDS = {
  protocols: "research-ai",
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

function getUseCaseVisual(id: (typeof USE_CASES)[number]["id"]): {
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
    body: "Connect agents with skill.md, coding-agents.md, MCP, and API keys.",
    action: "Open integrations →",
  };
}

export function dashboardHomeCtas(): DashboardHomeCta[] {
  const protocols = surfaceLink("protocols", "Open protocols");
  const regions = surfaceLink("regions", "Open regions");
  return [
    {
      id: "protocols",
      label: "Protocols",
      href: protocols.href,
      body: "Author Embeddable Knowledge Verification Protocols. The Protocol Challenge is the topic that run is scored against.",
      ...getUseCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.protocols),
      links: [protocols],
    },
    {
      id: "regions",
      label: "Knowledge Regions",
      href: regions.href,
      body: "Simulate exploration strategies on your protocols and inspect the resulting regions.",
      ...getUseCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.regions),
      links: [regions],
    },
  ];
}
