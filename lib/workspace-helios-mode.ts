/**
 * Learning Map right-column authoring mode: Helios Chat vs Manual drawers.
 * Play-only / no-authoring shells never gain Helios map-building.
 */

export type WorkspaceHeliosColumnMode = "helios" | "manual";

export const HELIOS_MAP_MODE_LABEL = "Helios";
export const MANUAL_MAP_MODE_LABEL = "Manual Mode";
export const DEFAULT_WORKSPACE_HELIOS_COLUMN_MODE: WorkspaceHeliosColumnMode =
  "helios";

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
 * Right-column Helios vs Manual surface.
 * Authoring default is Helios. Play-only / no-authoring shells stay
 * on Manual drawers and never mount Helios Chat.
 */
export function resolveWorkspaceHeliosColumnSurface(input: {
  authoring: boolean;
  playView?: boolean;
  mode?: unknown;
}): WorkspaceHeliosColumnSurface {
  const authoring = Boolean(input.authoring) && !input.playView;
  if (!authoring) {
    return {
      mode: "manual",
      showHeliosChat: false,
      showManualDrawers: true,
      showModeToggle: false,
    };
  }
  const mode = normalizeWorkspaceHeliosColumnMode(input.mode);
  const helios = mode === "helios";
  return {
    mode,
    showHeliosChat: helios,
    showManualDrawers: !helios,
    showModeToggle: true,
  };
}
