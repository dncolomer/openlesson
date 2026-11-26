import {
  sessionPolicyProofFromCanvas,
  type SessionPolicyProofEvent,
} from "@/lib/session-policy-infer";

/** Live HUD keeps a short window of classified canvas events. Infer still owns the 200-cap proof buffer. */
export const SESSION_POW_LOG_LIMIT = 48;
export const SESSION_POW_LOG_PROMPT_CHARS = 80;

/** Hidden: ⌘D / Ctrl+D toggles the classified PoW overlay. */
export function isSessionDeveloperModeShortcut(event: {
  key?: string;
  code?: string;
  metaKey?: boolean;
  ctrlKey?: boolean;
  altKey?: boolean;
  shiftKey?: boolean;
  repeat?: boolean;
}): boolean {
  if (event.repeat) return false;
  if (event.altKey || event.shiftKey) return false;
  if (!event.metaKey && !event.ctrlKey) return false;
  if (event.code === "KeyD") return true;
  return (event.key || "").toLowerCase() === "d";
}

export type SessionPowLogEntry = {
  id: string;
  at: number;
  action: string;
  prompt?: string;
};

export function sessionPowLogEntriesFromCanvas(
  events: readonly { toolAction?: unknown; metadata?: unknown }[],
  input: { at?: number; fromId?: number } = {},
): { entries: SessionPowLogEntry[]; nextId: number } {
  const at = input.at ?? Date.now();
  let nextId = input.fromId ?? 0;
  const mapped = sessionPolicyProofFromCanvas(events);
  const entries = mapped.map((event: SessionPolicyProofEvent) => {
    nextId += 1;
    return {
      id: String(nextId),
      at,
      action: event.action,
      ...(event.prompt ? { prompt: event.prompt } : {}),
    };
  });
  return { entries, nextId };
}

export function appendSessionPowLog(
  current: readonly SessionPowLogEntry[],
  incoming: readonly SessionPowLogEntry[],
  limit = SESSION_POW_LOG_LIMIT,
): SessionPowLogEntry[] {
  if (!incoming.length) return current.slice() as SessionPowLogEntry[];
  const next = current.concat(incoming);
  return next.length > limit ? next.slice(-limit) : next;
}

export function formatSessionPowLogLine(
  entry: Pick<SessionPowLogEntry, "action" | "prompt">,
  maxPrompt = SESSION_POW_LOG_PROMPT_CHARS,
): string {
  const action = entry.action.trim();
  const prompt = String(entry.prompt ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!prompt) return action;
  const clipped = prompt.length > maxPrompt ? `${prompt.slice(0, Math.max(0, maxPrompt - 1))}…` : prompt;
  return `${action}  ${clipped}`;
}
