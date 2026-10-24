/**
 * TAP Learning Work canvas xAI JSON salvage and parseIleXaiCanvasTurn.
 */
import { stripLearnerFacingWrappers } from "@/lib/session-format-wrapper";
import {
  asRecord,
  ileWorkCanvasFiniteOrigin,
  ileWorkCanvasXaiTextWidth,
  normalizeExtraSkeletons,
  type IleWorkCanvasSkeleton,
  type IleXaiCanvasTurnPayload,
} from "@/lib/learn-work-canvas-scene";

const ILE_XAI_REPLY_TEXT_KEYS = [
  "text",
  "message",
  "reply",
  "content",
  "coaching",
  "answer",
  "response",
] as const;

/** True when a reply is a canvas JSON payload rather than a sentence for the learner. */
export function ileXaiReplyIsCanvasJson(raw: string | null | undefined): boolean {
  const trimmed = String(raw || "").trim();
  if (!trimmed) return false;
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) return true;
  if (/```(?:json)?/i.test(trimmed) && trimmed.includes("{")) return true;
  return /"elements"\s*:/.test(trimmed) && /"(?:text|origin|type)"\s*:/.test(trimmed);
}

function repairLooseJson(source: string): string {
  return source.replace(/[\u201c\u201d]/g, '"').replace(/,\s*([}\]])/g, "$1");
}

function tryParseJsonObject(candidate: string): Record<string, unknown> | null {
  for (const attempt of [candidate, repairLooseJson(candidate)]) {
    try {
      const parsed = JSON.parse(attempt) as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      return parsed as Record<string, unknown>;
    } catch {
      /* try the repaired candidate */
    }
  }
  return null;
}

export function extractJsonObject(raw: string): Record<string, unknown> | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence?.[1]?.trim() || trimmed;
  const direct = tryParseJsonObject(candidate);
  if (direct) return direct;
  const start = candidate.indexOf("{");
  const end = candidate.lastIndexOf("}");
  if (start < 0 || end <= start) return null;
  return tryParseJsonObject(candidate.slice(start, end + 1));
}

function looksLikeJsonBlob(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (
    (trimmed.startsWith("{") && trimmed.endsWith("}")) ||
    (trimmed.startsWith("[") && trimmed.endsWith("]"))
  ) {
    return true;
  }
  return /```(?:json)?/i.test(trimmed);
}

function proseOutsideJson(raw: string): string {
  let text = raw.replace(/```(?:json)?\s*[\s\S]*?```/gi, " ");
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start >= 0 && end > start) {
    text = `${text.slice(0, start)} ${text.slice(end + 1)}`;
  }
  return text.replace(/\s+/g, " ").trim();
}

function salvageQuotedTextField(raw: string): string {
  const match = raw.match(
    /"(?:text|message|reply|content|coaching|answer|response)"\s*:\s*"((?:\\.|[^"\\])*)"/,
  );
  if (!match?.[1]) return "";
  try {
    return String(JSON.parse(`"${match[1]}"`) || "").trim();
  } catch {
    return match[1].replace(/\\n/g, "\n").replace(/\\"/g, '"').trim();
  }
}

function textFromParsedCanvasJson(parsed: Record<string, unknown>, depth = 0): string {
  if (depth > 2) return "";
  for (const key of ILE_XAI_REPLY_TEXT_KEYS) {
    const value = parsed[key];
    if (typeof value === "string") {
      const trimmed = value.trim();
      if (!trimmed || looksLikeJsonBlob(trimmed)) {
        if (!trimmed) continue;
        const inner = extractJsonObject(trimmed);
        const nested = inner ? textFromParsedCanvasJson(inner, depth + 1) : "";
        if (nested) return nested;
        const prose = proseOutsideJson(trimmed);
        if (prose && !looksLikeJsonBlob(prose)) return prose;
        continue;
      }
      return trimmed;
    }
    if (value && typeof value === "object" && !Array.isArray(value)) {
      const nested = textFromParsedCanvasJson(value as Record<string, unknown>, depth + 1);
      if (nested) return nested;
    }
  }
  return "";
}

function visibleTextFromXaiReply(source: string, parsed: Record<string, unknown> | null): string {
  const fromJson = parsed ? textFromParsedCanvasJson(parsed) : salvageQuotedTextField(source);
  if (fromJson && !looksLikeJsonBlob(fromJson)) return fromJson;
  if (!ileXaiReplyIsCanvasJson(source)) return source;
  const prose = proseOutsideJson(source);
  if (prose && !looksLikeJsonBlob(prose)) return prose;
  return "";
}

function originFromParsedCanvasJson(parsed: Record<string, unknown>): { x: number; y: number } | null {
  return (
    ileWorkCanvasFiniteOrigin(asRecord(parsed.origin)) ??
    ileWorkCanvasFiniteOrigin(asRecord(parsed.position)) ??
    ileWorkCanvasFiniteOrigin({ x: parsed.x, y: parsed.y })
  );
}

/** Parse an XAI reply into text + optional extra canvas skeletons + suggested origin. */
export function parseIleXaiCanvasTurn(raw: string | null | undefined): IleXaiCanvasTurnPayload {
  const source = String(raw || "").trim();
  if (!source) return { text: "", elements: [] };
  const parsed = extractJsonObject(source);
  const text = stripLearnerFacingWrappers(visibleTextFromXaiReply(source, parsed));
  if (!parsed) return { text, elements: [] };
  const elements = normalizeExtraSkeletons(parsed.elements ?? parsed.canvas_elements);
  const origin = originFromParsedCanvasJson(parsed);
  const textWidth = ileWorkCanvasXaiTextWidth(parsed.textWidth ?? parsed.text_width);
  return {
    text,
    elements,
    textWidth,
    turnId: typeof parsed.turnId === "string" ? parsed.turnId : null,
    origin,
  };
}

/**
 * Session-chat body for one assistant string.
 * `message` is the visible sentence. `raw` is that same assistant string, kept
 * so layout JSON is not discarded when the sentence and typed shapes are empty.
 */
export function ileSessionChatCanvasReply(assistantText: string | null | undefined): {
  message: string;
  canvasElements: IleWorkCanvasSkeleton[];
  raw: string;
} {
  const raw = String(assistantText || "").trim();
  const parsed = parseIleXaiCanvasTurn(raw);
  return {
    message: String(parsed.text || "").trim(),
    canvasElements: parsed.elements ?? [],
    raw,
  };
}

/**
 * Canvas ask result from a TAP Learning session-chat response.
 * A layout-only assistant string stays in `raw`. An empty visible sentence does
 * not become the error string when that raw reply is present.
 */
export function ileWorkCanvasAskFromSessionChat(input: {
  ok: boolean;
  message?: unknown;
  canvasElements?: unknown;
  raw?: unknown;
  errorMessage?: string | null;
}): {
  text: string;
  elements: IleWorkCanvasSkeleton[] | null;
  origin: { x?: number; y?: number } | null;
  raw: string;
} {
  if (!input.ok) {
    return {
      text: String(input.errorMessage || "").trim(),
      elements: null,
      origin: null,
      raw: "",
    };
  }
  const assistantRaw = typeof input.raw === "string" ? input.raw.trim() : "";
  const visible = typeof input.message === "string" ? input.message.trim() : "";
  const parsed = parseIleXaiCanvasTurn(assistantRaw || visible);
  const elements = Array.isArray(input.canvasElements)
    ? (input.canvasElements as IleWorkCanvasSkeleton[])
    : (parsed.elements ?? null);
  const text = visible || String(parsed.text || "").trim();
  if (!assistantRaw && !text) {
    return {
      text: String(input.errorMessage || "").trim(),
      elements,
      origin: parsed.origin ?? null,
      raw: "",
    };
  }
  return {
    text,
    elements,
    origin: parsed.origin ?? null,
    raw: assistantRaw,
  };
}

/** Sentence from a command reply. JSON canvas payloads contribute their text field only. */
export function ileWorkCanvasCommandProse(raw: string | null | undefined): string {
  const source = String(raw || "").trim();
  if (!source) return "";
  const parsed = parseIleXaiCanvasTurn(source);
  const prose = String(parsed.text ?? "").trim();
  if (prose) return prose;
  if (ileXaiReplyIsCanvasJson(source)) return "";
  return source;
}
