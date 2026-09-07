/**
 * Docked-chapter chip status after Submit work: loading until Helios replies,
 * then attention until the learner opens that chapter.
 */
import { normalizeIleOpenWorkId } from "@/lib/ile-pow-spend";

export const ILE_DOCK_CHIP_STATUSES = ["idle", "loading", "attention"] as const;
export type IleDockChipStatus = (typeof ILE_DOCK_CHIP_STATUSES)[number];

export function resolveIleDockChipStatus(input: {
  chapterId?: string | null;
  loadingIds?: readonly string[] | null;
  attentionIds?: readonly string[] | null;
}): IleDockChipStatus {
  const id = normalizeIleOpenWorkId(input.chapterId);
  if (!id) return "idle";
  if ((input.loadingIds ?? []).some((row) => normalizeIleOpenWorkId(row) === id)) {
    return "loading";
  }
  if ((input.attentionIds ?? []).some((row) => normalizeIleOpenWorkId(row) === id)) {
    return "attention";
  }
  return "idle";
}

export function chapterHasPendingHeliosReply(
  messages: readonly { role?: string | null; pending?: boolean | null }[] | null | undefined,
): boolean {
  if (!messages?.length) return false;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant") return Boolean(message.pending);
  }
  return false;
}

export function latestSettledAssistantId(
  messages: readonly { id?: string | null; role?: string | null; pending?: boolean | null }[] | null | undefined,
): string | null {
  if (!messages?.length) return null;
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role === "assistant" && !message.pending) {
      const id = String(message.id || "").trim();
      if (id) return id;
    }
  }
  return null;
}

export function sameIleIdList(
  left: readonly string[],
  right: readonly string[],
): boolean {
  if (left.length !== right.length) return false;
  return left.every((id, index) => id === right[index]);
}
