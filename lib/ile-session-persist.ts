import type { Session } from "@/lib/domain/types";
import { enqueueIleSessionSave } from "@/lib/ile-session-save-queue";
import { mergeRememberedSessionPolicy } from "@/lib/session-policy-store";

/**
 * Write the session row after any save already in flight.
 * The reader runs at write time, and the remembered policy is merged back on.
 */
export function persistIleSessionRow(
  read: () => Session | null,
  tokens: { ayclToken?: string | null; ileToken?: string | null },
): Promise<void> {
  const ayclToken = tokens.ayclToken || "";
  const ileToken = tokens.ileToken || "";
  return enqueueIleSessionSave(async () => {
    const session = read();
    if (!session) return;
    const metadata = mergeRememberedSessionPolicy(
      (session.metadata || {}) as Record<string, unknown>,
      session.id,
    ) as Session["metadata"];
    const row = metadata === session.metadata ? session : { ...session, metadata };
    if (ayclToken) {
      const { saveAyclSession } = await import("@/lib/aycl-storage");
      await saveAyclSession(ayclToken, row);
      return;
    }
    if (ileToken) {
      const { saveIleLinkSession } = await import("@/lib/ile-link-storage");
      await saveIleLinkSession(ileToken, row);
      return;
    }
    const { saveSession } = await import("@/lib/storage");
    await saveSession(row);
  });
}
