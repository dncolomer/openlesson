/**
 * Flows are archived, never hard-deleted. Play copies keep live references.
 */

export type FlowArchiveFields = {
  archivedAt?: string | null;
};

export function flowArchivedAtFromRow(row: {
  archived_at?: unknown;
  archivedAt?: unknown;
} | null | undefined): string | null {
  const raw = row?.archivedAt ?? row?.archived_at;
  const value = typeof raw === "string" ? raw.trim() : "";
  return value || null;
}

export function isFlowArchived(
  flow: FlowArchiveFields | { archived_at?: unknown } | null | undefined,
): boolean {
  if (!flow) return false;
  if ("archivedAt" in flow) return Boolean(String(flow.archivedAt || "").trim());
  return Boolean(flowArchivedAtFromRow(flow));
}

export function listedAuthorFlows<T extends FlowArchiveFields>(
  flows: readonly T[],
): T[] {
  return flows.filter((flow) => !isFlowArchived(flow));
}

export function publicInviteClaimReason(
  flow: FlowArchiveFields | null | undefined,
): "archived" | null {
  return isFlowArchived(flow) ? "archived" : null;
}

export function archiveFlowStamp(now = new Date()): { archivedAt: string } {
  return { archivedAt: now.toISOString() };
}
