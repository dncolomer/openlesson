/**
 * ILE session map vs dedicated Welcome settings route.
 * Settings is a full-screen path, not a DialogFrame on the map.
 */

export function isIleSessionSettingsPath(pathname: string | null | undefined): boolean {
  const path = String(pathname || "").split("?")[0].replace(/\/+$/, "");
  return path.endsWith("/settings");
}

function withResume(path: string, resume?: boolean): string {
  if (!resume) return path;
  return path.includes("?") ? `${path}&resume=1` : `${path}?resume=1`;
}

export function ileSessionMapPath(input: {
  sessionId: string;
  ileToken?: string | null;
  ayclToken?: string | null;
  resume?: boolean;
}): string {
  const id = encodeURIComponent(input.sessionId);
  if (input.ileToken) {
    return withResume(`/ile/session/${encodeURIComponent(input.ileToken)}`, input.resume);
  }
  if (input.ayclToken) {
    return withResume(
      `/learn/${encodeURIComponent(input.ayclToken)}/session?id=${id}`,
      input.resume,
    );
  }
  return withResume(`/session?id=${id}`, input.resume);
}

/**
 * After Welcome settings is confirmed, the map session must re-arm:
 * fresh learners get Help; returning learners start recording.
 * Idle when still on the settings route, settings are not confirmed, or capture is already live.
 */
export function decideIleSettingsEnterMap(input: {
  settingsConfirmed: boolean;
  onSettingsRoute: boolean;
  welcomeSeen: boolean;
  recording: boolean;
}): "help" | "record" | "idle" {
  if (!input.settingsConfirmed || input.onSettingsRoute || input.recording) {
    return "idle";
  }
  return input.welcomeSeen ? "record" : "help";
}

/**
 * First load of Welcome must not `router.replace` onto the settings URL.
 * That navigation remounts SessionView, so the welcome screen paints, drops
 * to the loading shell, and paints again. `replace-state` updates the address
 * while the current screen stays mounted. A real router navigation is only
 * needed when the settings page itself is what is mounted and Welcome closes.
 */
export function ileWelcomeRouteSync(input: {
  showWelcome: boolean;
  browserPath: string;
  routerPath: string;
  settingsHref: string;
  mapHref: string;
}):
  | { kind: "replace-state"; href: string }
  | { kind: "router-replace"; href: string }
  | { kind: "none" } {
  const browserOnSettings = isIleSessionSettingsPath(input.browserPath);
  const routerOnSettings = isIleSessionSettingsPath(input.routerPath);
  if (input.showWelcome && !browserOnSettings) {
    return { kind: "replace-state", href: input.settingsHref };
  }
  if (!input.showWelcome && browserOnSettings) {
    if (routerOnSettings) return { kind: "router-replace", href: input.mapHref };
    return { kind: "replace-state", href: input.mapHref };
  }
  return { kind: "none" };
}

export function ileSessionSettingsPath(input: {
  sessionId: string;
  ileToken?: string | null;
  ayclToken?: string | null;
  resume?: boolean;
}): string {
  const id = encodeURIComponent(input.sessionId);
  if (input.ileToken) {
    return withResume(
      `/ile/session/${encodeURIComponent(input.ileToken)}/settings`,
      input.resume,
    );
  }
  if (input.ayclToken) {
    return withResume(
      `/learn/${encodeURIComponent(input.ayclToken)}/session/settings?id=${id}`,
      input.resume,
    );
  }
  return withResume(`/session/settings?id=${id}`, input.resume);
}
