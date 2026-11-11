/**
 * Compact Home overview: three product CTA boxes.
 */

import { dashboardHrefForTab, type DashboardTab } from "@/lib/dashboard-nav";
import { USE_CASES } from "@/lib/marketing/use-cases";

/** Home product boxes reuse the use-cases stills, mapped by product. */
export const DASHBOARD_HOME_CTA_USE_CASE_IDS = {
  solve: "research-ai",
  verification: "team-insight",
  calibration: "technical-hiring",
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

function productSurfaceLinks(
  kind: "solve" | "verification" | "calibration",
): DashboardHomeCtaLink[] {
  const regions = `${kind}_regions` as DashboardTab;
  const studio = `${kind}_studio` as DashboardTab;
  return [
    {
      id: kind,
      label: "Flows",
      href: dashboardHrefForTab(kind),
    },
    {
      id: regions,
      label: "Knowledge regions",
      href: dashboardHrefForTab(regions),
    },
    {
      id: studio,
      label: "Data Studio",
      href: dashboardHrefForTab(studio),
    },
  ];
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
  const solveLinks = productSurfaceLinks("solve");
  const verificationLinks = productSurfaceLinks("verification");
  const calibrationLinks = productSurfaceLinks("calibration");
  return [
    {
      id: "solve",
      label: "Solve / Practice",
      href: solveLinks[0]!.href,
      body: "Author Solve flows, knowledge regions, and Data Studio runs.",
      ...useCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.solve),
      links: solveLinks,
    },
    {
      id: "verification",
      label: "Verification",
      href: verificationLinks[0]!.href,
      body: "Author Verification flows, knowledge regions, and Data Studio runs.",
      ...useCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.verification),
      links: verificationLinks,
    },
    {
      id: "calibration",
      label: "Calibration",
      href: calibrationLinks[0]!.href,
      body: "Author Calibration flows, knowledge regions, and Data Studio runs.",
      ...useCaseVisual(DASHBOARD_HOME_CTA_USE_CASE_IDS.calibration),
      links: calibrationLinks,
    },
  ];
}
