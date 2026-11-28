/**
 * Dedicated OpenRouter Chat Completions client for AI-use region simulation.
 * Never use getChat() / callXai here. The API key is the org-sealed
 * OpenRouter secret from Organization backends — not process env.
 */
import { createHash, createHmac } from "node:crypto";

export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_ROUND_TIMEOUT_MS = 25_000;
export const OPENROUTER_MAX_ATTEMPTS = 2;
export const OPENROUTER_MAX_RETRY_DELAY_MS = 8_000;
export const OPENROUTER_ORG_KEY_MISSING =
  "OpenRouter API key is not configured for this organization";

export type OpenRouterMessage = {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | null;
  tool_call_id?: string;
  name?: string;
  tool_calls?: OpenRouterToolCall[];
};

export type OpenRouterToolCall = {
  id: string;
  type: "function";
  function: { name: string; arguments: string };
};

export type OpenRouterTool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type OpenRouterChatRequest = {
  model: string;
  messages: readonly OpenRouterMessage[];
  tools?: readonly OpenRouterTool[];
  tool_choice?: "auto" | "required" | "none";
  max_tokens?: number;
  temperature?: number;
  reasoning?: { exclude?: boolean; effort?: string; max_tokens?: number };
  extra?: Record<string, unknown>;
  user?: string;
  dataCollection?: "allow" | "deny";
  /** Org-sealed OpenRouter key. Required at the default client; tests inject it. */
  apiKey?: string;
};

export type OpenRouterChatResult = {
  message: OpenRouterMessage;
  toolCalls: OpenRouterToolCall[];
  finishReason: string | null;
  costUsd: number;
  generationId: string | null;
  wallMs: number;
};

type FetchLike = typeof fetch;
type SleepLike = (ms: number) => Promise<void>;

let fetchOverride: FetchLike | null = null;
let sleepOverride: SleepLike | null = null;

export function setOpenRouterFetchForTests(fn: FetchLike | null): void {
  fetchOverride = fn;
}

export function setOpenRouterSleepForTests(fn: SleepLike | null): void {
  sleepOverride = fn;
}

function parseRetryAfterMs(header: string | null): number | null {
  if (!header) return null;
  const trimmed = header.trim();
  if (!trimmed) return null;
  const seconds = Number(trimmed);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.min(OPENROUTER_MAX_RETRY_DELAY_MS, Math.round(seconds * 1000));
  }
  const dateMs = Date.parse(trimmed);
  if (Number.isFinite(dateMs)) {
    return Math.max(0, Math.min(OPENROUTER_MAX_RETRY_DELAY_MS, dateMs - Date.now()));
  }
  return null;
}

async function waitBeforeRetry(error: unknown, attempt: number): Promise<void> {
  const retryAfterMs =
    error && typeof error === "object" && "retryAfterMs" in error
      ? Number((error as { retryAfterMs?: unknown }).retryAfterMs)
      : NaN;
  const delayMs =
    Number.isFinite(retryAfterMs) && retryAfterMs >= 0
      ? Math.min(OPENROUTER_MAX_RETRY_DELAY_MS, retryAfterMs)
      : Math.min(OPENROUTER_MAX_RETRY_DELAY_MS, 1000 * (attempt + 1));
  if (delayMs <= 0) return;
  if (sleepOverride) {
    await sleepOverride(delayMs);
    return;
  }
  await new Promise((resolve) => setTimeout(resolve, delayMs));
}

export function openRouterBaseUrl(): string {
  const raw = String(process.env.OPENROUTER_BASE_URL || "").trim();
  return (raw || OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function openRouterJobMaxUsd(): number {
  const raw = Number(process.env.OPENROUTER_JOB_MAX_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

let warnedHashSecretFallback = false;

function openRouterHashSecret(): string {
  const dedicated = [
    process.env.XAI_ORG_KEY_ENCRYPTION_SECRET,
    process.env.ORG_SECRETS_ENCRYPTION_KEY,
  ].find((value) => typeof value === "string" && value.trim());
  if (!dedicated && process.env.NODE_ENV === "production" && !warnedHashSecretFallback) {
    warnedHashSecretFallback = true;
    console.warn(
      "[openrouter] XAI_ORG_KEY_ENCRYPTION_SECRET / ORG_SECRETS_ENCRYPTION_KEY unset; using fallback user hash secret.",
    );
  }
  return String(dedicated || "openlesson").slice(0, 32);
}

export function openRouterUserHash(ownerUserId: string, hmacSecret?: string): string {
  const id = String(ownerUserId || "").trim();
  const secret = String(hmacSecret || openRouterHashSecret()).slice(0, 32);
  return createHmac("sha256", secret).update(id).digest("hex").slice(0, 32);
}

export function openRouterHeaders(apiKey: string | null | undefined): Record<string, string> {
  const key = String(apiKey || "").trim();
  if (!key) {
    throw new Error(OPENROUTER_ORG_KEY_MISSING);
  }
  const referer = String(process.env.NEXT_PUBLIC_APP_URL || "https://uncertain.systems").replace(
    /\/+$/,
    "",
  );
  return {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/json",
    "HTTP-Referer": referer,
    "X-OpenRouter-Title": "OpenLesson",
  };
}

function isRetryableStatus(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function shouldRetry(error: unknown, attempt: number): boolean {
  if (attempt >= OPENROUTER_MAX_ATTEMPTS - 1) return false;
  const name = error && typeof error === "object" && "name" in error ? String(error.name) : "";
  const message = error instanceof Error ? error.message : "";
  if (name === "TimeoutError" || /aborted due to timeout/i.test(message)) return false;
  if (error && typeof error === "object" && "status" in error) {
    return isRetryableStatus(Number((error as { status: unknown }).status));
  }
  return true;
}

function parseCost(payload: Record<string, unknown>): number {
  const usage = payload.usage;
  if (!usage || typeof usage !== "object") return 0;
  const record = usage as {
    cost?: unknown;
    total_cost?: unknown;
    prompt_tokens?: unknown;
    completion_tokens?: unknown;
  };
  const direct = Number(record.cost ?? record.total_cost);
  if (Number.isFinite(direct) && direct > 0) return direct;
  const promptTokens = Number(record.prompt_tokens);
  const completionTokens = Number(record.completion_tokens);
  const safePrompt = Number.isFinite(promptTokens) && promptTokens > 0 ? promptTokens : 0;
  const safeCompletion =
    Number.isFinite(completionTokens) && completionTokens > 0 ? completionTokens : 0;
  if (safePrompt + safeCompletion > 0) {
    // Conservative fallback floor so missing OpenRouter usage.cost never bypasses OPENROUTER_JOB_MAX_USD.
    const estimated = (safePrompt * 0.15 + safeCompletion * 0.6) / 1_000_000;
    return Math.max(0.00001, estimated);
  }
  return 0;
}

function parseToolCalls(message: Record<string, unknown> | null): OpenRouterToolCall[] {
  if (!message) return [];
  const raw = message.tool_calls;
  if (!Array.isArray(raw)) return [];
  const out: OpenRouterToolCall[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as {
      id?: unknown;
      type?: unknown;
      function?: { name?: unknown; arguments?: unknown };
    };
    const id = String(row.id || "").trim();
    const name = String(row.function?.name || "").trim();
    if (!id || !name) continue;
    out.push({
      id,
      type: "function",
      function: {
        name,
        arguments: typeof row.function?.arguments === "string" ? row.function.arguments : "{}",
      },
    });
  }
  return out;
}

export async function openRouterChatCompletions(
  input: OpenRouterChatRequest,
): Promise<OpenRouterChatResult> {
  const url = `${openRouterBaseUrl()}/chat/completions`;
  const body: Record<string, unknown> = {
    model: input.model,
    messages: input.messages,
    max_tokens: input.max_tokens ?? 4096,
    temperature: input.temperature ?? 0.2,
    user: input.user,
    usage: { include: true },
    ...(input.reasoning ? { reasoning: { exclude: true, ...input.reasoning } } : {}),
    provider: {
      require_parameters: Boolean(input.tools?.length || input.reasoning),
      data_collection: input.dataCollection === "allow" ? "allow" : "deny",
    },
    ...(input.extra || {}),
  };
  if (input.tools?.length) {
    body.tools = input.tools;
    body.tool_choice = input.tool_choice ?? "required";
  }

  const fetcher = fetchOverride || fetch;
  let lastError: unknown = null;
  for (let attempt = 0; attempt < OPENROUTER_MAX_ATTEMPTS; attempt += 1) {
    const started = Date.now();
    try {
      const response = await fetcher(url, {
        method: "POST",
        headers: openRouterHeaders(input.apiKey),
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(OPENROUTER_ROUND_TIMEOUT_MS),
      });
      const wallMs = Date.now() - started;
      const payload = (await response.json().catch(() => ({}))) as Record<string, unknown>;
      if (!response.ok) {
        const err = new Error(
          `OpenRouter ${response.status}: ${String((payload.error as { message?: string } | undefined)?.message || response.statusText)}`,
        ) as Error & { status: number; retryAfterMs?: number };
        err.status = response.status;
        const retryAfterMs = parseRetryAfterMs(response.headers.get("retry-after"));
        if (retryAfterMs !== null) err.retryAfterMs = retryAfterMs;
        throw err;
      }
      const choices = Array.isArray(payload.choices) ? payload.choices : [];
      const choice = (choices[0] || {}) as { message?: Record<string, unknown>; finish_reason?: unknown };
      const rawMessage = choice.message || {};
      const toolCalls = parseToolCalls(rawMessage);
      const message: OpenRouterMessage = {
        role: "assistant",
        content: typeof rawMessage.content === "string" ? rawMessage.content : null,
        tool_calls: toolCalls.length ? toolCalls : undefined,
      };
      return {
        message,
        toolCalls,
        finishReason: typeof choice.finish_reason === "string" ? choice.finish_reason : null,
        costUsd: parseCost(payload),
        generationId: typeof payload.id === "string" ? payload.id : null,
        wallMs,
      };
    } catch (error) {
      lastError = error;
      if (!shouldRetry(error, attempt)) throw error;
      await waitBeforeRetry(error, attempt);
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");
}

export function stableToolCallId(seed: string, index: number): string {
  return `call_${createHash("sha256").update(`${seed}:${index}`).digest("hex").slice(0, 16)}`;
}
