export const LTI_IDENTITY_PREFIX = "lti:";

export function ltiParticipantIdentity(issuer: string, sub: string): string {
  const iss = String(issuer || "").trim();
  const subject = String(sub || "").trim();
  if (!iss || !subject) return "";
  return `${LTI_IDENTITY_PREFIX}${iss}:${subject}`;
}

export function isLtiParticipantIdentity(raw: string): boolean {
  return String(raw || "").trim().startsWith(LTI_IDENTITY_PREFIX);
}

export function ltiSubjectFromIdentity(identity: string, issuer: string): string {
  const id = String(identity || "").trim();
  const iss = String(issuer || "").trim();
  if (!id || !iss) return "";
  const prefix = `${LTI_IDENTITY_PREFIX}${iss}:`;
  if (!id.startsWith(prefix)) return "";
  return id.slice(prefix.length);
}

export function ltiDisplayName(claims: {
  name?: unknown;
  given_name?: unknown;
  family_name?: unknown;
  email?: unknown;
} | Record<string, unknown>): string {
  const name = String(claims.name || "").trim();
  if (name) return name;
  const given = String(claims.given_name || "").trim();
  const family = String(claims.family_name || "").trim();
  const joined = [given, family].filter(Boolean).join(" ").trim();
  if (joined) return joined;
  return String(claims.email || "").trim();
}
