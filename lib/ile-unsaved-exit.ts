/**
 * Discard an ILE session on "Exit without saving".
 * Deletes the chapter map (`session_plans`) and stamps `unsaved_exit` so the
 * session disappears from Previous Sessions. Does not touch Proof of Work.
 */
import { applyIleUnsavedExitToMetadata } from "@/lib/ile-session-name";

export const SESSION_PLAN_DISCARD_PATH = "/api/session-plan/discard";

export function ileUnsavedExitSessionPatch(metadata: unknown): {
  metadata: Record<string, unknown>;
} {
  const base =
    metadata && typeof metadata === "object" && !Array.isArray(metadata)
      ? (metadata as Record<string, unknown>)
      : {};
  return { metadata: applyIleUnsavedExitToMetadata(base) };
}

export async function discardUnsavedIleSession(input: {
  sessionId: string;
  guestAccessBody?: Record<string, unknown>;
}): Promise<void> {
  const sessionId = String(input.sessionId || "").trim();
  if (!sessionId) return;
  const res = await fetch(SESSION_PLAN_DISCARD_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sessionId,
      ...(input.guestAccessBody || {}),
    }),
  });
  if (res.ok) return;
  const json = (await res.json().catch(() => ({}))) as { error?: unknown };
  const err = json.error;
  const message =
    typeof err === "string"
      ? err
      : err && typeof err === "object" && "message" in err
        ? String((err as { message?: unknown }).message || "Failed to discard session")
        : "Failed to discard session";
  throw new Error(message);
}
