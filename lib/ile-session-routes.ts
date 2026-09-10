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
