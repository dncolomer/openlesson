// ============================================
// xAI CLIENT
//
// Single, centralized client for xAI REST APIs. Handles both:
//   - POST /v1/chat/completions  (callXai, callXaiJSON, callXaiText, callXaiWithSchema, callXaiWithImage)
//   - POST /v1/responses         (callXaiResponses, callXaiResponsesWithFiles)
//
// Shared: env/config, retry+backoff, JSON-parse fallback, schema enforcement.
//
// For the Files API see lib/xai-files.ts, STT lib/xai-stt.ts, TTS app/api/xai-tts,
// image gen lib/plan-image.ts.
//
// Client components: import model constants from lib/xai-models.ts only.
// Do not import this module from "use client" files (server-only API key path).
// ============================================

// ============================================
// CONFIG
// ============================================

import {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  type ModelId,
  type ModelOption,
  type ReasoningEffort,
} from "@/lib/xai-models";

export {
  AVAILABLE_MODELS,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  type ModelId,
  type ModelOption,
  type ReasoningEffort,
};

const XAI_CHAT_URL = "https://api.x.ai/v1/chat/completions";
const XAI_RESPONSES_URL = "https://api.x.ai/v1/responses";

export interface ProviderInfo {
  provider: "xai";
  label: string;
  defaultModel: string;
  chatUrl: string;
  hasXAIKey: boolean;
}

export function getProviderInfo(): ProviderInfo {
  return {
    provider: "xai",
    label: "xAI Direct",
    defaultModel: DEFAULT_MODEL,
    chatUrl: XAI_CHAT_URL,
    hasXAIKey: !!process.env.XAI_API_KEY,
  };
}

function getApiKey(override?: string | null): string {
  if (override) return override;
  // Only resolve request-scoped org keys on the server (AsyncLocalStorage).
  if (typeof window === "undefined") {
    try {
      // Lazy require to avoid circular deps / client bundling of async_hooks
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { getContextualXaiApiKey } = require("@/lib/xai-context") as {
        getContextualXaiApiKey: () => string | null;
      };
      const ctxKey = getContextualXaiApiKey();
      if (ctxKey) return ctxKey;
    } catch {
      /* no context */
    }
  }
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY not configured. Set it in your .env.local file.");
  return key;
}

function getHeaders(apiKey?: string | null): Record<string, string> {
  return {
    Authorization: `Bearer ${getApiKey(apiKey)}`,
    "Content-Type": "application/json",
  };
}

/** Optional per-request credentials (e.g. per-organization xAI API key). */
export type XaiAuthOptions = {
  apiKey?: string | null;
};

// ============================================
// SHARED UTILS
// ============================================

function isRetryableError(status: number): boolean {
  return status === 429 || (status >= 500 && status < 600);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Strip common model wrappers (markdown fences, leading labels) so JSON.parse
 * has a cleaner shot at the payload.
 */
function stripJsonWrappers(text: string): string {
  let t = String(text ?? "").trim();
  // ```json ... ``` or ``` ... ```
  const fenced = t.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenced?.[1]) {
    t = fenced[1].trim();
  }
  // Leading "json" / "JSON:" labels some models emit before the object
  t = t.replace(/^(?:json|JSON)\s*[:\n]\s*/i, "").trim();
  return t;
}

/**
 * Whether `s` ends inside an open double-quoted string (best-effort, handles \").
 */
function endsInsideJsonString(s: string): boolean {
  let inString = false;
  let escape = false;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (ch === "\\") {
      escape = true;
      continue;
    }
    if (ch === '"') inString = !inString;
  }
  return inString;
}

/**
 * Close unbalanced braces/brackets (truncated model output). Best-effort only —
 * string-interior brackets can still confuse this heuristic.
 */
function closeTruncatedJson(fragment: string): string {
  let s = fragment.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, " ");

  // Close a cut-off string before balancing containers.
  if (endsInsideJsonString(s)) {
    s += '"';
  }

  s = s.replace(/,\s*([}\]])/g, "$1");
  // Drop trailing incomplete key or bare comma after value
  s = s.replace(/,\s*"[^"]*"\s*:\s*$/g, "");
  s = s.replace(/,\s*$/g, "");

  const openBraces = (s.match(/\{/g) || []).length;
  const closeBraces = (s.match(/\}/g) || []).length;
  const openBrackets = (s.match(/\[/g) || []).length;
  const closeBrackets = (s.match(/\]/g) || []).length;
  s += "]".repeat(Math.max(0, openBrackets - closeBrackets));
  s += "}".repeat(Math.max(0, openBraces - closeBraces));
  return s;
}

/**
 * Slice from first `{` or `[` through last matching closer when complete,
 * or through end of string when truncated (repair step closes containers).
 */
function extractJsonCandidate(text: string): string | null {
  const objStart = text.indexOf("{");
  const arrStart = text.indexOf("[");
  let start = -1;
  if (objStart >= 0 && (arrStart < 0 || objStart < arrStart)) start = objStart;
  else if (arrStart >= 0) start = arrStart;
  if (start < 0) return null;

  // Prefer complete balanced slice when a closer exists after start.
  const completeObj = text.slice(start).match(/^\{[\s\S]*\}/);
  const completeArr = text.slice(start).match(/^\[[\s\S]*\]/);
  if (text[start] === "{" && completeObj) return completeObj[0];
  if (text[start] === "[" && completeArr) return completeArr[0];

  // Truncated: take from first opener to end for repair.
  return text.slice(start).trim();
}

/**
 * Parse a response body as JSON, with a few fallbacks:
 *   1. direct JSON.parse (after stripping markdown fences)
 *   2. extract the first {...} or [...] block and parse
 *   3. strip control chars / dangling commas / repair truncation, then parse
 * Returns { ok: true, data } on success, { ok: false } on failure.
 */
export function parseJsonLoose<T>(text: string): { ok: true; data: T } | { ok: false } {
  const prepared = stripJsonWrappers(text);

  try {
    return { ok: true, data: JSON.parse(prepared) as T };
  } catch {
    // fall through
  }

  const candidate = extractJsonCandidate(prepared);
  if (!candidate) return { ok: false };

  try {
    return { ok: true, data: JSON.parse(candidate) as T };
  } catch {
    // fall through
  }

  // Cleanup + truncated-JSON repair (common when max_tokens cuts mid-object).
  const cleaned = closeTruncatedJson(candidate);
  try {
    return { ok: true, data: JSON.parse(cleaned) as T };
  } catch {
    return { ok: false };
  }
}

// ============================================
// /v1/chat/completions — TYPES
// ============================================

export interface Message {
  role: "system" | "user" | "assistant";
  content: string | MessageContent[];
}

export type MessageContent =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

export interface JsonSchema {
  name: string;
  strict?: boolean;
  schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
    additionalProperties?: boolean;
  };
}

export interface XaiChatConfig {
  model?: string;
  maxTokens: number;
  temperature: number;
  responseFormat?: "json" | "json_schema";
  jsonSchema?: JsonSchema;
  /**
   * Reasoning depth for grok-4.5+. Chat Completions uses top-level
   * `reasoning_effort`. Defaults to DEFAULT_REASONING_EFFORT ("low").
   * Note: `stop` is not supported with reasoning models.
   */
  reasoningEffort?: ReasoningEffort;
  stop?: string | string[];
  retries?: number;
  retryDelay?: number;
  /** Per-request fetch timeout in milliseconds. */
  fetchTimeout?: number;
  /** Per-organization xAI API key (server-resolved). Falls back to XAI_API_KEY. */
  apiKey?: string | null;
}

export interface XaiResponse<T = string> {
  success: boolean;
  data?: T;
  rawContent?: string;
  error?: string;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatAPIResponse {
  id: string;
  choices: Array<{
    message: { content: string };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

interface ChatRequestBody {
  model: string;
  messages: Message[];
  max_tokens: number;
  temperature: number;
  reasoning_effort?: ReasoningEffort;
  response_format?: { type: "json_object" } | { type: "json_schema"; json_schema: JsonSchema };
  stop?: string | string[];
}

function buildChatBody(messages: Message[], config: XaiChatConfig): ChatRequestBody {
  const body: ChatRequestBody = {
    model: config.model || DEFAULT_MODEL,
    messages,
    max_tokens: config.maxTokens,
    temperature: config.temperature,
    // Explicit effort — xAI defaults grok-4.5 to "high", which is slow for interactive UX.
    reasoning_effort: config.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
  };
  if (config.responseFormat === "json") {
    body.response_format = { type: "json_object" };
  } else if (config.responseFormat === "json_schema" && config.jsonSchema) {
    body.response_format = { type: "json_schema", json_schema: config.jsonSchema };
  }
  // `stop` is not supported by reasoning models (grok-4.5+); only send if caller opts in
  // and we are not using reasoning (unlikely path kept for non-reasoning model ids).
  if (config.stop) body.stop = config.stop;
  return body;
}

// ============================================
// /v1/chat/completions — CLIENT
// ============================================

/**
 * Make a request to xAI's chat completions endpoint with retry logic and
 * optional JSON response-format handling.
 */
export async function callXai<T = string>(
  messages: Message[],
  config: XaiChatConfig
): Promise<XaiResponse<T>> {
  const maxRetries = config.retries ?? 3;
  const baseDelay = config.retryDelay ?? 1000;
  let lastError: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: getHeaders(config.apiKey),
        body: JSON.stringify(buildChatBody(messages, config)),
      };
      if (config.fetchTimeout) {
        fetchOptions.signal = AbortSignal.timeout(config.fetchTimeout);
      }

      const response = await fetch(XAI_CHAT_URL, fetchOptions);

      if (!response.ok) {
        const errorText = await response.text();
        console.error(`[xai] chat error (attempt ${attempt + 1}):`, response.status, errorText);
        if (isRetryableError(response.status) && attempt < maxRetries - 1) {
          await sleep(baseDelay * Math.pow(2, attempt));
          lastError = `API error: ${response.status}`;
          continue;
        }
        return { success: false, error: `API error: ${response.status} - ${errorText}` };
      }

      const data: ChatAPIResponse = await response.json();
      const rawMessageContent = data.choices?.[0]?.message?.content;
      // Some multimodal/reasoning payloads return content parts; flatten to text.
      const content =
        typeof rawMessageContent === "string"
          ? rawMessageContent
          : Array.isArray(rawMessageContent)
            ? (rawMessageContent as Array<{ type?: string; text?: string }>)
                .map((p) => (typeof p?.text === "string" ? p.text : ""))
                .filter(Boolean)
                .join("\n")
            : rawMessageContent == null
              ? ""
              : String(rawMessageContent);
      if (!content.trim()) return { success: false, error: "No content in response" };

      if (config.responseFormat === "json" || config.responseFormat === "json_schema") {
        const parsed = parseJsonLoose<T>(content);
        if (parsed.ok) {
          return { success: true, data: parsed.data, rawContent: content, usage: data.usage };
        }
        console.error(
          "[xai] failed to parse JSON (attempt",
          attempt + 1,
          "). Raw content:",
          content.substring(0, 500),
        );
        lastError = "Failed to parse JSON from response";
        // Retry — models occasionally emit fences/prose or get truncated mid-JSON.
        if (attempt < maxRetries - 1) {
          await sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        return {
          success: false,
          error: lastError,
          rawContent: content,
        };
      }

      return { success: true, data: content.trim() as T, rawContent: content, usage: data.usage };
    } catch (error) {
      console.error(`[xai] chat request failed (attempt ${attempt + 1}):`, error);
      lastError = error instanceof Error ? error.message : "Unknown error";
      if (attempt < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, attempt));
        continue;
      }
    }
  }

  return { success: false, error: lastError || "Request failed after retries" };
}

// ============================================
// /v1/chat/completions — CONVENIENCE
// ============================================

export async function callXaiJSON<T>(
  messages: Message[],
  config: Omit<XaiChatConfig, "responseFormat">
): Promise<XaiResponse<T>> {
  return callXai<T>(messages, {
    ...config,
    responseFormat: "json",
    temperature: Math.min(config.temperature, 0.3),
  });
}

export async function callXaiWithSchema<T>(
  messages: Message[],
  schema: JsonSchema,
  config: Omit<XaiChatConfig, "responseFormat" | "jsonSchema">
): Promise<XaiResponse<T>> {
  return callXai<T>(messages, {
    ...config,
    responseFormat: "json_schema",
    jsonSchema: schema,
    temperature: Math.min(config.temperature, 0.2),
  });
}

export async function callXaiText(
  messages: Message[],
  config: Omit<XaiChatConfig, "responseFormat">
): Promise<XaiResponse<string>> {
  return callXai<string>(messages, config);
}

// ============================================
// PREDEFINED JSON SCHEMAS (chat completions)
// ============================================

export const SCHEMAS = {
  gapAnalysis: {
    name: "gap_analysis",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        gap_score: { type: "number", description: "Score from 0.0 to 1.0" },
        signals: { type: "array", items: { type: "string" }, description: "Detected gap signals" },
        transcript: { type: "string", description: "Brief summary of what the student said" },
      },
      required: ["gap_score", "signals"],
      additionalProperties: false,
    },
  },

  sessionPlan: {
    name: "session_plan",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        goal: { type: "string", description: "Learning goal for the session" },
        strategy: { type: "string", description: "Approach for guiding the student" },
        steps: {
          type: "array",
          items: {
            type: "object",
            properties: {
              type: { type: "string", enum: ["question", "task", "suggestion", "checkpoint"] },
              description: { type: "string" },
              keyword: { type: "string", description: "1 or 2 map-tile words (4-28 characters)" },
              order: { type: "number" },
            },
            required: ["type", "description", "keyword", "order"],
          },
        },
      },
      required: ["goal", "strategy", "steps"],
      additionalProperties: false,
    },
  },

  workspaceBlocks: {
    name: "learning_blocks",
    strict: true,
    schema: {
      type: "object" as const,
      properties: {
        nodes: {
          type: "array",
          items: {
            type: "object",
            properties: {
              id: { type: "string" },
              title: { type: "string" },
              description: { type: "string" },
              is_start: { type: "boolean" },
              next: { type: "array", items: { type: "string" } },
            },
            required: ["id", "title", "description", "is_start"],
          },
        },
      },
      required: ["nodes"],
      additionalProperties: false,
    },
  },
} as const;

export const RECOMMENDED_TEMPS = {
  json: 0.1,
  jsonSchema: 0.0,
  gapDetection: 0.1,
  probeGeneration: 0.7,
  openingProbe: 0.7,
  chat: 0.7,
  report: 0.6,
} as const;

// ============================================
// MULTIMODAL (image inline).
// PDFs/documents: upload via lib/xai-files.ts, then reference via the Responses
// API below (input_file). Audio: lib/xai-stt.ts.
// ============================================

export interface ImageInput {
  /** Base64-encoded image data */
  data: string;
  /** Image MIME type, defaults to "image/png" */
  mimeType?: string;
}

export function buildImageContent(text: string, image: ImageInput): MessageContent[] {
  const mimeType = image.mimeType || "image/png";
  return [
    { type: "text", text },
    { type: "image_url", image_url: { url: `data:${mimeType};base64,${image.data}` } },
  ];
}

export async function callXaiWithImage<T>(
  prompt: string,
  image: ImageInput,
  config: Omit<XaiChatConfig, "responseFormat"> & {
    responseFormat?: "json" | "json_schema" | "text";
  }
): Promise<XaiResponse<T>> {
  const content = buildImageContent(prompt, image);
  const messages: Message[] = [{ role: "user", content }];

  if (config.responseFormat === "text" || !config.responseFormat) {
    return callXai<T>(messages, { ...config, responseFormat: undefined });
  }

  return callXai<T>(messages, {
    ...config,
    responseFormat: config.responseFormat as "json" | "json_schema",
    temperature: Math.min(config.temperature, 0.2),
  });
}

// ============================================
// SIMPLE MESSAGE BUILDERS
// ============================================

export function userMessage(content: string): Message {
  return { role: "user", content };
}

export function systemMessage(content: string): Message {
  return { role: "system", content };
}

export function assistantMessage(content: string): Message {
  return { role: "assistant", content };
}

export function buildConversation(systemPrompt: string, ...userMessages: string[]): Message[] {
  return [systemMessage(systemPrompt), ...userMessages.map(userMessage)];
}

export function buildMessages(prompt: string, systemPrompt?: string): Message[] {
  if (systemPrompt) return [systemMessage(systemPrompt), userMessage(prompt)];
  return [userMessage(prompt)];
}

// ============================================
// /v1/responses — TYPES
//
// Used when we need to attach uploaded files to a chat message via `input_file`
// references. Grok auto-activates the `attachment_search` server-side tool and
// agentically searches the documents to answer.
//
// Reference:
//   https://docs.x.ai/developers/model-capabilities/files/chat-with-files
//   https://docs.x.ai/docs/api-reference#responses
// ============================================

export type ResponsesInputContent =
  | { type: "input_text"; text: string }
  | { type: "input_file"; file_id?: string; file_url?: string }
  | { type: "input_image"; image_url: string };

export interface ResponsesInputMessage {
  role: "system" | "user" | "assistant";
  content: string | ResponsesInputContent[];
}

export interface CallResponsesOptions {
  model?: string;
  input: string | ResponsesInputMessage[];
  instructions?: string;
  maxOutputTokens?: number;
  temperature?: number;
  /**
   * Reasoning depth. Responses API field is `reasoning.effort`.
   * Defaults to DEFAULT_REASONING_EFFORT ("low") for latency.
   */
  reasoningEffort?: ReasoningEffort;
  /**
   * Whether xAI should persist the response for later retrieval.
   * Defaults to false — large file-backed chats (demo performance, PoW)
   * hit "Response is too large to store" when store is true (API default).
   * We manage conversation history client/server-side already.
   */
  store?: boolean;
  /** When provided, forces structured JSON output via text.format. */
  jsonSchema?: { name: string; schema: Record<string, unknown> };
  /** Per-request timeout in milliseconds */
  fetchTimeout?: number;
  retries?: number;
  retryDelay?: number;
  /** Per-organization xAI API key (server-resolved). Falls back to XAI_API_KEY. */
  apiKey?: string | null;
}

export interface CallResponsesResult<T = unknown> {
  success: boolean;
  data?: T;
  /** Raw text output from the model (concatenated from output_text parts) */
  text?: string;
  /** Raw response from xAI for debugging */
  raw?: unknown;
  error?: string;
}

interface ResponsesOutputItem {
  type: string;
  content?: Array<{ type: string; text?: string }>;
}

interface ResponsesAPIResponse {
  id: string;
  status: string;
  output?: ResponsesOutputItem[];
  error?: { message?: string };
}

function extractOutputText(response: ResponsesAPIResponse): string {
  if (!response.output) return "";
  let combined = "";
  for (const item of response.output) {
    if (item.type === "message" && item.content) {
      for (const part of item.content) {
        if (part.type === "output_text" && typeof part.text === "string") {
          combined += part.text;
        }
      }
    }
  }
  return combined.trim();
}

// ============================================
// /v1/responses — CLIENT
// ============================================

export async function callXaiResponses<T = unknown>(
  options: CallResponsesOptions
): Promise<CallResponsesResult<T>> {
  const maxRetries = options.retries ?? 3;
  const baseDelay = options.retryDelay ?? 1000;

  const body: Record<string, unknown> = {
    model: options.model || DEFAULT_MODEL,
    input: options.input,
    // Avoid "Response is too large to store" on file-heavy requests; we don't use previous_response_id.
    store: options.store ?? false,
    // Explicit effort — API default for grok-4.5 is "high".
    reasoning: {
      effort: options.reasoningEffort ?? DEFAULT_REASONING_EFFORT,
    },
  };
  if (options.instructions) body.instructions = options.instructions;
  if (typeof options.maxOutputTokens === "number") body.max_output_tokens = options.maxOutputTokens;
  if (typeof options.temperature === "number") body.temperature = options.temperature;
  if (options.jsonSchema) {
    body.text = {
      format: {
        type: "json_schema",
        name: options.jsonSchema.name,
        schema: options.jsonSchema.schema,
        strict: true,
      },
    };
  }

  let lastError: string | undefined;

  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const fetchOptions: RequestInit = {
        method: "POST",
        headers: getHeaders(options.apiKey),
        body: JSON.stringify(body),
      };
      if (options.fetchTimeout) {
        fetchOptions.signal = AbortSignal.timeout(options.fetchTimeout);
      }

      const res = await fetch(XAI_RESPONSES_URL, fetchOptions);

      if (!res.ok) {
        const errorText = await res.text();
        console.error(`[xai] responses error (attempt ${attempt + 1}):`, res.status, errorText);
        if (isRetryableError(res.status) && attempt < maxRetries - 1) {
          await sleep(baseDelay * Math.pow(2, attempt));
          lastError = `API error: ${res.status}`;
          continue;
        }
        return { success: false, error: `API error: ${res.status} - ${errorText.slice(0, 500)}` };
      }

      const apiResponse = (await res.json()) as ResponsesAPIResponse;
      const text = extractOutputText(apiResponse);

      if (!text) {
        return { success: false, error: "No text in response output", raw: apiResponse };
      }

      if (options.jsonSchema) {
        const parsed = parseJsonLoose<T>(text);
        if (parsed.ok) {
          return { success: true, data: parsed.data, text, raw: apiResponse };
        }
        console.error(
          "[xai] responses JSON parse failed (attempt",
          attempt + 1,
          "). Raw text:",
          text.substring(0, 500),
        );
        lastError = "Failed to parse JSON from response";
        if (attempt < maxRetries - 1) {
          await sleep(baseDelay * Math.pow(2, attempt));
          continue;
        }
        return {
          success: false,
          error: lastError,
          text,
          raw: apiResponse,
        };
      }

      return { success: true, text, raw: apiResponse };
    } catch (error) {
      console.error(`[xai] responses request failed (attempt ${attempt + 1}):`, error);
      lastError = error instanceof Error ? error.message : "Unknown error";
      if (attempt < maxRetries - 1) {
        await sleep(baseDelay * Math.pow(2, attempt));
      }
    }
  }

  return { success: false, error: lastError || "Request failed after retries" };
}

/** xAI Responses API hard limit for input_file attachments per request. */
export const XAI_MAX_FILE_ATTACHMENTS = 20;

/** Deduplicate and keep the most recent file IDs within the xAI attachment cap. */
export function capXaiFileAttachments(fileIds: string[], max = XAI_MAX_FILE_ATTACHMENTS): string[] {
  const unique = [...new Set(fileIds.filter(Boolean))];
  if (unique.length <= max) return unique;
  return unique.slice(-max);
}

/**
 * Convenience helper: call Responses API with a prompt + uploaded file IDs.
 * Each file_id is attached as an input_file content part — Grok agentically
 * searches through the docs via the attachment_search tool.
 */
export async function callXaiResponsesWithFiles<T = unknown>(
  prompt: string,
  fileIds: string[],
  options: Omit<CallResponsesOptions, "input"> = {} as Omit<CallResponsesOptions, "input">
): Promise<CallResponsesResult<T>> {
  const content: ResponsesInputContent[] = [{ type: "input_text", text: prompt }];
  for (const fileId of capXaiFileAttachments(fileIds)) {
    content.push({ type: "input_file", file_id: fileId });
  }

  return callXaiResponses<T>({
    ...options,
    input: [{ role: "user", content }],
  });
}
