export async function ltiIdentityForPublicToken(token: string): Promise<string | null> {
  const expected = String(token || "").trim();
  if (!expected) return null;
  const response = await fetch("/api/lti/me");
  if (!response.ok) return null;
  const payload = (await response.json().catch(() => ({}))) as {
    identity?: string;
    flowToken?: string | null;
  };
  if (String(payload.flowToken || "").trim() !== expected) return null;
  return String(payload.identity || "").trim() || null;
}
