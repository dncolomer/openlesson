/**
 * Settings subtabs by workspace kind.
 * Knowledge Region: Knowledge Regions, Data Studio, Integration only.
 */

import {
  isKnowledgeRegionWorkspace,
  workspaceAllowsKnowledgeLinkMint,
} from "@/lib/workspace-kind";

export type SettingsSubview =
  | "general"
  | "aycl"
  | "regions"
  | "knowledge-portal"
  | "guest-links"
  | "data-studio"
  | "integrations";

export const ALL_SETTINGS_SUBVIEWS: readonly SettingsSubview[] = [
  "general",
  "aycl",
  "regions",
  "knowledge-portal",
  "guest-links",
  "data-studio",
  "integrations",
];

export const KNOWLEDGE_REGION_SETTINGS_SUBVIEWS: readonly SettingsSubview[] = [
  "regions",
  "data-studio",
  "integrations",
];

export function availableSettingsSubviews(kind: unknown): readonly SettingsSubview[] {
  return isKnowledgeRegionWorkspace(kind)
    ? KNOWLEDGE_REGION_SETTINGS_SUBVIEWS
    : ALL_SETTINGS_SUBVIEWS;
}

export function defaultSettingsSubview(kind: unknown): SettingsSubview {
  return isKnowledgeRegionWorkspace(kind) ? "regions" : "general";
}

export function resolveSettingsSubview(
  requested: unknown,
  kind: unknown,
): SettingsSubview {
  const allowed = availableSettingsSubviews(kind);
  if (typeof requested === "string" && (allowed as readonly string[]).includes(requested)) {
    return requested as SettingsSubview;
  }
  return defaultSettingsSubview(kind);
}

export function settingsSubviewLabel(
  id: SettingsSubview,
  kind: unknown,
  t?: (key: string) => string,
): string {
  switch (id) {
    case "general":
      return "General";
    case "aycl":
      return "AYCL";
    case "regions":
      return "Knowledge Regions";
    case "knowledge-portal":
      return t?.("planView.knowledgePortalSettingsTab") ?? "Knowledge Portal";
    case "guest-links":
      return t?.("planView.performanceSubTabTap") ?? "Knowledge Links";
    case "data-studio":
      return "Data Studio";
    case "integrations":
      return isKnowledgeRegionWorkspace(kind) ? "Integration" : "Integrations";
  }
}

export function settingsSubTabsForKind(
  kind: unknown,
  t: (key: string) => string,
): Array<{ id: SettingsSubview; label: string }> {
  return availableSettingsSubviews(kind).map((id) => ({
    id,
    label: settingsSubviewLabel(id, kind, t),
  }));
}

/** Guest-links / Knowledge Links mint UI is omitted on Knowledge Region. */
export function settingsShowsKnowledgeLinks(kind: unknown): boolean {
  return workspaceAllowsKnowledgeLinkMint(kind);
}
