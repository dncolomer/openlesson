/**
 * Browser fetch for a policy inference reply.
 * This module does not import the xAI client. Tests never call it.
 */

export async function requestSessionPolicyReply(
  body: Record<string, unknown>,
): Promise<string | null> {
  try {
    const response = await fetch("/api/ile/session-policy-infer", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!response.ok) return null;
    const payload = (await response.json()) as { reply?: unknown };
    return typeof payload.reply === "string" && payload.reply.trim() ? payload.reply : null;
  } catch {
    return null;
  }
}
