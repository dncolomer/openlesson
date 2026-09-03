"use client";

import type { WorkspaceSectionNavItem } from "@/components/WorkspaceSectionNav";
import type { WorkspaceSectionKey } from "@/lib/workspace-sections";

export function buildWorkspaceSectionNavItems(input: {
  t: (key: string) => string;
  isLearnerMode: boolean;
  isOwner: boolean;
  visibleSections: WorkspaceSectionKey[];
  /** Explore overlay hides authoring Map Types (Play already omits them). */
  exploreOpen?: boolean;
}): WorkspaceSectionNavItem[] {
  const { t, isLearnerMode, isOwner, visibleSections, exploreOpen } = input;
  // Nav order: Workspace → DAGs → Map Types → Goals → Context → Simulation → Knowledge → Settings
  // Knowledge Region shells omit Workspace (no map tab).
  return [
    ...(visibleSections.includes("workspace")
      ? [
          {
            key: "workspace" as const,
            label: t("planView.sectionWorkspace"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6z" />
              </svg>
            ),
          },
        ]
      : []),
    // Creator owner-only — second tab after Workspace
    ...(!isLearnerMode && isOwner && visibleSections.includes("dags")
      ? [
          {
            key: "dags" as const,
            label: t("planView.sectionDags"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 7.5h3v3h-3v-3zm6 0h3v3h-3v-3zm-6 6h3v3h-3v-3zm6 0h3v3h-3v-3z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 9h3M9 10.5v3M13.5 13.5h-3M15 13.5v-3" />
              </svg>
            ),
          },
        ]
      : []),
    ...(!isLearnerMode &&
    !exploreOpen &&
    isOwner &&
    visibleSections.includes("map_types")
      ? [
          {
            key: "map_types" as const,
            label: t("planView.sectionMapTypes"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 6.75v10.5M12 6.75v10.5m5.25-10.5v10.5" />
              </svg>
            ),
          },
        ]
      : []),
    ...(!isLearnerMode && visibleSections.includes("goals")
      ? [
          {
            key: "goals" as const,
            label: t("planView.sectionGoals") || "Goals",
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("context")
      ? [
          {
            key: "context" as const,
            label: t("planView.sectionContext"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("simulation")
      ? [
          {
            key: "simulation" as const,
            label: t("planView.sectionSimulation"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("knowledge")
      ? [
          {
            key: "knowledge" as const,
            label: t("planView.sectionKnowledge"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.456 2.456L21.75 6l-1.035.259a3.375 3.375 0 00-2.456 2.456z" />
              </svg>
            ),
          },
        ]
      : []),
    ...(visibleSections.includes("settings")
      ? [
          {
            key: "settings" as const,
            label: t("planView.sectionSetting"),
            icon: (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25M14.25 4.5l-4.5 15" />
              </svg>
            ),
          },
        ]
      : []),
  ];
}
