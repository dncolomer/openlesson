/**
 * Learning Map right-column authoring surface.
 * Helios Chat is retired; authoring and play-only shells use Manual drawers.
 */

export type WorkspaceHeliosColumnMode = "helios" | "manual";

export const HELIOS_MAP_MODE_LABEL = "Helios";
export const MANUAL_MAP_MODE_LABEL = "Manual Mode";
export const DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE: WorkspaceHeliosColumnMode =
  "manual";

export function isWorkspaceHeliosColumnMode(
  value: unknown,
): value is WorkspaceHeliosColumnMode {
  return value === "helios" || value === "manual";
}

export function normalizeWorkspaceHeliosColumnMode(
  value: unknown,
  fallback: WorkspaceHeliosColumnMode = DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE,
): WorkspaceHeliosColumnMode {
  return isWorkspaceHeliosColumnMode(value) ? value : fallback;
}

export function toggleWorkspaceHeliosColumnMode(
  current: unknown,
): WorkspaceHeliosColumnMode {
  return normalizeWorkspaceHeliosColumnMode(current) === "helios"
    ? "manual"
    : "helios";
}

export type WorkspaceHeliosColumnSurface = {
  mode: WorkspaceHeliosColumnMode;
  showHeliosChat: boolean;
  showManualDrawers: boolean;
  showModeToggle: boolean;
};

/**
 * Right-column surface. Helios Chat is unmounted; Manual drawers always show.
 * `mode` is accepted for stored values and ignored for chrome.
 */
export function resolveWorkspaceHeliosColumnSurface(_input: {
  authoring: boolean;
  playView?: boolean;
  mode?: unknown;
}): WorkspaceHeliosColumnSurface {
  return {
    mode: "manual",
    showHeliosChat: false,
    showManualDrawers: true,
    showModeToggle: false,
  };
}
