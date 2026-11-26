/**
 * Dedicated OpenRouter Chat Completions client for AI-use region simulation.
 * Never use getChat() / callXai here. The API key is the org-sealed
 * OpenRouter secret from Organization backends — not process env.
 */
import { createHash, createHmac } from "node:crypto";

export const OPENROUTER_DEFAULT_BASE_URL = "https://openrouter.ai/api/v1";
export const OPENROUTER_ROUND_TIMEOUT_MS = 45_000;
export const OPENROUTER_MAX_ATTEMPTS = 2;
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

let fetchOverride: FetchLike | null = null;

export function setOpenRouterFetchForTests(fn: FetchLike | null): void {
  fetchOverride = fn;
}

export function openRouterBaseUrl(): string {
  const raw = String(process.env.OPENROUTER_BASE_URL || "").trim();
  return (raw || OPENROUTER_DEFAULT_BASE_URL).replace(/\/+$/, "");
}

export function openRouterJobMaxUsd(): number {
  const raw = Number(process.env.OPENROUTER_JOB_MAX_USD);
  return Number.isFinite(raw) && raw > 0 ? raw : 5;
}

function openRouterHashSecret(): string {
  const dedicated = [
    process.env.XAI_ORG_KEY_ENCRYPTION_SECRET,
    process.env.ORG_SECRETS_ENCRYPTION_KEY,
  ].find((value) => typeof value === "string" && value.trim());
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
  const referer = String(process.env.NEXT_PUBLIC_APP_URL || "https://openlesson.app").replace(
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
  const cost = Number((usage as { cost?: unknown }).cost);
  return Number.isFinite(cost) && cost > 0 ? cost : 0;
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
    reasoning: { exclude: true, ...(input.reasoning || {}) },
    provider: {
      require_parameters: true,
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
        ) as Error & { status: number };
        err.status = response.status;
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
    }
  }
  throw lastError instanceof Error ? lastError : new Error("OpenRouter request failed");
}

export function stableToolCallId(seed: string, index: number): string {
  return `call_${createHash("sha256").update(`${seed}:${index}`).digest("hex").slice(0, 16)}`;
}
