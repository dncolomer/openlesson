/**
 * Pure progress state for multi-subject LWM Snapshot-all runs.
 * Used by the LWM UI and unit tests — no I/O.
 */

import { subjectKey, type SnapshotSubjectRef } from "./workspace-snapshot-subjects";

export type SnapshotAllSubjectStatus = "ok" | "skipped" | "failed" | "running";

export type SnapshotAllSubjectResult = {
  user_id: string | null;
  guest_user_id: string | null;
  status: SnapshotAllSubjectStatus;
  error?: string;
  code?: string;
  eval_run_history_id?: string | null;
  label?: string;
};

/** NDJSON / UI events emitted while snapshot-all runs. */
export type SnapshotAllProgressEvent =
  | {
      type: "start";
      workspace_id?: string;
      total: number;
      label?: string;
    }
  | {
      type: "subject_start";
      index: number; // 1-based
      total: number;
      user_id: string | null;
      guest_user_id: string | null;
      label?: string;
    }
  | {
      type: "subject";
      index: number; // 1-based
      total: number;
      user_id: string | null;
      guest_user_id: string | null;
      status: "ok" | "skipped" | "failed";
      error?: string;
      code?: string;
      eval_run_history_id?: string | null;
      label?: string;
    }
  | {
      type: "complete";
      workspace_id?: string;
      total: number;
      succeeded: number;
      skipped: number;
      failed: number;
      label?: string;
    }
  | {
      type: "error";
      error: string;
    };

export type SnapshotAllProgressState = {
  phase: "idle" | "running" | "complete" | "error";
  workspace_id?: string;
  total: number;
  /** Subjects finished (ok + skipped + failed). */
  completed: number;
  succeeded: number;
  skipped: number;
  failed: number;
  /** 1-based index of subject currently running, if any. */
  currentIndex: number | null;
  currentLabel: string | null;
  results: SnapshotAllSubjectResult[];
  summary: string | null;
  error: string | null;
};

export function initialSnapshotAllProgress(): SnapshotAllProgressState {
  return {
    phase: "idle",
    total: 0,
    completed: 0,
    succeeded: 0,
    skipped: 0,
    failed: 0,
    currentIndex: null,
    currentLabel: null,
    results: [],
    summary: null,
    error: null,
  };
}

export function labelForSnapshotSubject(
  subject: SnapshotSubjectRef,
  options?: { currentUserId?: string | null },
): string {
  const guest = subject.guest_user_id?.trim();
  const user = subject.user_id?.trim();
  if (guest) return `Guest ${guest.slice(0, 8)}…`;
  if (user && options?.currentUserId && user === options.currentUserId) return "You";
  if (user) return `User ${user.slice(0, 8)}…`;
  return "Subject";
}

/**
 * Human-readable progress line for the LWM panel.
 * Pure — derived only from state.
 */
export function formatSnapshotAllProgress(state: SnapshotAllProgressState): string {
  if (state.phase === "idle") return "";
  if (state.phase === "error") {
    return state.error ? `Snapshot all failed: ${state.error}` : "Snapshot all failed";
  }
  if (state.phase === "complete") {
    return (
      state.summary ||
      `Snapshot complete: ${state.succeeded} succeeded, ${state.skipped} skipped, ${state.failed} failed (${state.total} subjects).`
    );
  }
  // running
  if (state.total <= 0) return "Starting snapshot for all users…";
  const done = state.completed;
  const current = state.currentLabel
    ? ` · ${state.currentLabel}`
    : state.currentIndex
      ? ` · subject ${state.currentIndex}`
      : "";
  return `Snapshot all: ${done}/${state.total} done${current} (${state.succeeded} ok, ${state.skipped} skipped, ${state.failed} failed)`;
}

/**
 * Reduce a progress event into UI state.
 */
export function reduceSnapshotAllProgress(
  state: SnapshotAllProgressState,
  event: SnapshotAllProgressEvent,
): SnapshotAllProgressState {
  switch (event.type) {
    case "start": {
      return {
        ...initialSnapshotAllProgress(),
        phase: "running",
        workspace_id: event.workspace_id,
        total: Math.max(0, event.total),
        summary: null,
        error: null,
      };
    }
    case "subject_start": {
      return {
        ...state,
        phase: "running",
        total: event.total > 0 ? event.total : state.total,
        currentIndex: event.index,
        currentLabel:
          event.label ||
          labelForSnapshotSubject({
            user_id: event.user_id,
            guest_user_id: event.guest_user_id,
          }),
      };
    }
    case "subject": {
      const result: SnapshotAllSubjectResult = {
        user_id: event.user_id,
        guest_user_id: event.guest_user_id,
        status: event.status,
        error: event.error,
        code: event.code,
        eval_run_history_id: event.eval_run_history_id,
        label: event.label,
      };
      const succeeded = state.succeeded + (event.status === "ok" ? 1 : 0);
      const skipped = state.skipped + (event.status === "skipped" ? 1 : 0);
      const failed = state.failed + (event.status === "failed" ? 1 : 0);
      const completed = state.completed + 1;
      return {
        ...state,
        phase: "running",
        total: event.total > 0 ? event.total : state.total,
        completed,
        succeeded,
        skipped,
        failed,
        currentIndex: null,
        currentLabel: null,
        results: [...state.results, result],
      };
    }
    case "complete": {
      const total = event.total > 0 ? event.total : state.total;
      const summary = `Snapshot complete: ${event.succeeded} succeeded, ${event.skipped} skipped, ${event.failed} failed (${total} subjects).`;
      return {
        ...state,
        phase: "complete",
        workspace_id: event.workspace_id ?? state.workspace_id,
        total,
        completed: total,
        succeeded: event.succeeded,
        skipped: event.skipped,
        failed: event.failed,
        currentIndex: null,
        currentLabel: null,
        summary,
        error: null,
      };
    }
    case "error": {
      return {
        ...state,
        phase: "error",
        currentIndex: null,
        currentLabel: null,
        error: event.error,
        summary: null,
      };
    }
    default:
      return state;
  }
}

/** Parse one NDJSON line into an event (or null if blank/invalid). */
export function parseSnapshotAllProgressLine(line: string): SnapshotAllProgressEvent | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  try {
    const raw = JSON.parse(trimmed) as Record<string, unknown>;
    const type = raw.type;
    if (type === "start") {
      return {
        type: "start",
        workspace_id: typeof raw.workspace_id === "string" ? raw.workspace_id : undefined,
        total: Number(raw.total) || 0,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "subject_start") {
      return {
        type: "subject_start",
        index: Number(raw.index) || 0,
        total: Number(raw.total) || 0,
        user_id: (raw.user_id as string | null) ?? null,
        guest_user_id: (raw.guest_user_id as string | null) ?? null,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "subject") {
      const status = raw.status;
      if (status !== "ok" && status !== "skipped" && status !== "failed") return null;
      return {
        type: "subject",
        index: Number(raw.index) || 0,
        total: Number(raw.total) || 0,
        user_id: (raw.user_id as string | null) ?? null,
        guest_user_id: (raw.guest_user_id as string | null) ?? null,
        status,
        error: typeof raw.error === "string" ? raw.error : undefined,
        code: typeof raw.code === "string" ? raw.code : undefined,
        eval_run_history_id:
          raw.eval_run_history_id === null
            ? null
            : typeof raw.eval_run_history_id === "string"
              ? raw.eval_run_history_id
              : undefined,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "complete") {
      return {
        type: "complete",
        workspace_id: typeof raw.workspace_id === "string" ? raw.workspace_id : undefined,
        total: Number(raw.total) || 0,
        succeeded: Number(raw.succeeded) || 0,
        skipped: Number(raw.skipped) || 0,
        failed: Number(raw.failed) || 0,
        label: typeof raw.label === "string" ? raw.label : undefined,
      };
    }
    if (type === "error") {
      return {
        type: "error",
        error: typeof raw.error === "string" ? raw.error : "Unknown error",
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Consume an NDJSON text buffer, returning parsed events and remaining incomplete line.
 */
export function consumeSnapshotAllNdjson(
  buffer: string,
  chunk: string,
): { events: SnapshotAllProgressEvent[]; rest: string } {
  const combined = buffer + chunk;
  const parts = combined.split("\n");
  const rest = parts.pop() ?? "";
  const events: SnapshotAllProgressEvent[] = [];
  for (const part of parts) {
    const ev = parseSnapshotAllProgressLine(part);
    if (ev) events.push(ev);
  }
  return { events, rest };
}

export function subjectResultKey(r: Pick<SnapshotAllSubjectResult, "user_id" | "guest_user_id">): string {
  return subjectKey({ user_id: r.user_id, guest_user_id: r.guest_user_id });
}
