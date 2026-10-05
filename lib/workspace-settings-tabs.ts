/**
 * Settings subtabs by workspace product.
 * Learning workspace: General, AYCL, Integrations.
 * Verification workspace: General (includes Make Public), Knowledge Regions,
 * Data Studio, Integration.
 * Knowledge Portal is not a settings section.
 */

import { isKnowledgeRegionWorkspace } from "@/lib/workspace-kind";
import { workspaceSupportsFeature } from "@/lib/workspace-capabilities";

export type SettingsSubview =
  | "general"
  | "aycl"
  | "regions"
  | "data-studio"
  | "integrations";

export const LEARNING_SETTINGS_SUBVIEWS: readonly SettingsSubview[] = [
  "general",
  "aycl",
  "integrations",
];

export const VERIFICATION_SETTINGS_SUBVIEWS: readonly SettingsSubview[] = [
  "general",
  "regions",
  "data-studio",
  "integrations",
];

/** @deprecated Use LEARNING_SETTINGS_SUBVIEWS. Portal and verification tabs are gone. */
export const ALL_SETTINGS_SUBVIEWS: readonly SettingsSubview[] = LEARNING_SETTINGS_SUBVIEWS;

/** @deprecated Use VERIFICATION_SETTINGS_SUBVIEWS. */
export const KNOWLEDGE_REGION_SETTINGS_SUBVIEWS: readonly SettingsSubview[] =
  VERIFICATION_SETTINGS_SUBVIEWS;

export function availableSettingsSubviews(kind: unknown): readonly SettingsSubview[] {
  return isKnowledgeRegionWorkspace(kind)
    ? VERIFICATION_SETTINGS_SUBVIEWS
    : LEARNING_SETTINGS_SUBVIEWS;
}

export function defaultSettingsSubview(_kind?: unknown): SettingsSubview {
  return "general";
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
  _t?: (key: string) => string,
): string {
  switch (id) {
    case "general":
      return "General";
    case "aycl":
      return "AYCL";
    case "regions":
      return "Knowledge Regions";
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

/** Knowledge Portal is removed from both products. */
export function settingsShowsKnowledgeLinks(_kind?: unknown): boolean {
  return false;
}

export function settingsShowsMakePublic(kind: unknown): boolean {
  return workspaceSupportsFeature(kind, "make_public");
}
