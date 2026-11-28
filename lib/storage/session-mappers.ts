import type { Probe, Session } from "@/lib/domain/types";

export function mapDbProbe(row: Record<string, unknown>): Probe {
  return {
    id: String(row.id),
    timestamp: Number(row.timestamp_ms ?? 0),
    gapScore: Number(row.gap_score ?? 0),
    signals: Array.isArray(row.signals) ? (row.signals as string[]) : [],
    text: String(row.text ?? ""),
    expandedText: row.expanded_text != null ? String(row.expanded_text) : undefined,
    starred: Boolean(row.starred),
    isRevealed: Boolean(row.is_revealed),
    requestType: (row.request_type as Probe["requestType"]) ?? "question",
    planStepId: row.plan_step_id != null ? String(row.plan_step_id) : undefined,
    archived: Boolean(row.archived),
    focused: Boolean(row.focused),
  };
}

export function mapDbSession(
  row: Record<string, unknown>,
  probes: Probe[] = [],
  defaultStatus: Session["status"] = "completed",
): Session {
  const metadata = (row.metadata as Session["metadata"]) || {};
  const metaRecord = metadata as Record<string, unknown>;
  const storedObjectives = metaRecord.objectives;
  return {
    id: String(row.id),
    problem: String(row.problem ?? ""),
    startedAt: String(row.created_at ?? new Date().toISOString()),
    endedAt: row.ended_at != null ? String(row.ended_at) : undefined,
    durationMs: Number(row.duration_ms ?? 0),
    status: (row.status as Session["status"]) || defaultStatus,
    probes,
    objectives: Array.isArray(storedObjectives) ? (storedObjectives as string[]) : [],
    hasAudio: false,
    audioPath: undefined,
    report: undefined,
    reportGeneratedAt: undefined,
    transcript: undefined,
    workspaceTitle:
      typeof metaRecord.title === "string" ? metaRecord.title : undefined,
    planningPrompt:
      row.planning_prompt != null ? String(row.planning_prompt) : undefined,
    metadata,
  };
}
