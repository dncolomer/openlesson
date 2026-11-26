/**
 * Org-admin BYOK for LLM chat and document storage.
 * Pure record → public view / runtime config / session credit amount.
 * Platform-provisioned xAI Management keys (`xai_api_key_ciphertext`) are not BYOK.
 */

import {
  CANVAS_ASK_MODEL,
  CANVAS_COMMAND_MODEL,
  DEFAULT_MODEL,
} from "@/lib/xai-models";
import { flowSessionCreditCost } from "@/lib/credits/ledger";

/** Matches `ChatConfig` in lib/ai/chat.ts without importing that module. */
export type OrgChatConfig = {
  baseURL: string;
  apiKey: string | null;
  model: string;
  canvasAskModel: string;
  canvasCommandModel: string;
};

export const ORG_BACKEND_MODES = ["platform", "custom"] as const;
export type OrgBackendMode = (typeof ORG_BACKEND_MODES)[number];

export const ORG_BACKEND_PROVIDERS = ["xai", "openai-compatible"] as const;
export type OrgBackendProvider = (typeof ORG_BACKEND_PROVIDERS)[number];

export const DEFAULT_XAI_CHAT_BASE_URL = "https://api.x.ai/v1";
export const DEFAULT_XAI_FILES_BASE_URL = "https://api.x.ai";

export const ORG_SECRET_COLUMNS = [
  "xai_api_key_ciphertext",
  "llm_api_key_ciphertext",
  "blob_api_key_ciphertext",
  "openrouter_api_key_ciphertext",
] as const;

export type OrgBackendRecord = {
  llm_backend?: string | null;
  llm_provider?: string | null;
  llm_base_url?: string | null;
  llm_api_key_ciphertext?: string | null;
  llm_api_key_last_four?: string | null;
  llm_model?: string | null;
  blob_backend?: string | null;
  blob_provider?: string | null;
  blob_base_url?: string | null;
  blob_api_key_ciphertext?: string | null;
  blob_api_key_last_four?: string | null;
  openrouter_api_key_ciphertext?: string | null;
  openrouter_api_key_last_four?: string | null;
};

export type OrgBackendStored = {
  llm_backend: OrgBackendMode;
  llm_provider: OrgBackendProvider | null;
  llm_base_url: string | null;
  llm_api_key_ciphertext: string | null;
  llm_api_key_last_four: string | null;
  llm_model: string | null;
  blob_backend: OrgBackendMode;
  blob_provider: OrgBackendProvider | null;
  blob_base_url: string | null;
  blob_api_key_ciphertext: string | null;
  blob_api_key_last_four: string | null;
  openrouter_api_key_ciphertext: string | null;
  openrouter_api_key_last_four: string | null;
};

export type OrgBackendEndpointPublic = {
  mode: OrgBackendMode;
  provider: OrgBackendProvider | null;
  baseUrl: string | null;
  model?: string | null;
  configured: boolean;
  lastFour: string | null;
};

export type OrgOpenRouterPublic = {
  configured: boolean;
  lastFour: string | null;
};

export type OrgBackendPublic = {
  llm: OrgBackendEndpointPublic;
  blob: OrgBackendEndpointPublic;
  openrouter: OrgOpenRouterPublic;
  llmIsXai: boolean;
  sessionCreditCost: number;
};

export type BlobStoreConfig = {
  kind: string;
  baseURL: string | null;
  apiKey: string | null;
  dir?: string | null;
};

export type OrgBackendRuntime = {
  chat: OrgChatConfig;
  blob: BlobStoreConfig;
  llmIsXai: boolean;
  sessionCreditCost: number;
  source: "org" | "platform";
};

export type OrgBackendActor = {
  organization_id?: string | null;
  is_org_admin?: boolean | null;
};

export type OrgBackendGuard =
  | { ok: true; organizationId: string }
  | { ok: false; error: string; status: number };

export type OrgBackendPatchInput = {
  llm?: {
    mode?: string;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    model?: string;
    clearKey?: boolean;
  };
  blob?: {
    mode?: string;
    provider?: string;
    baseUrl?: string;
    apiKey?: string;
    clearKey?: boolean;
  };
  openrouter?: {
    apiKey?: string;
    clearKey?: boolean;
  };
};

export type ParsedOrgBackendMutation = {
  llm?: {
    mode: OrgBackendMode;
    provider: OrgBackendProvider | null;
    baseUrl: string | null;
    apiKey: string | null;
    model: string | null;
    clearKey: boolean;
  };
  blob?: {
    mode: OrgBackendMode;
    provider: OrgBackendProvider | null;
    baseUrl: string | null;
    apiKey: string | null;
    clearKey: boolean;
  };
  openrouter?: {
    apiKey: string | null;
    clearKey: boolean;
  };
};

export function trimSlash(url: string): string {
  return url.replace(/\/+$/, "");
}

export function isXaiBaseUrl(url: string | null | undefined): boolean {
  const value = String(url || "").trim().toLowerCase();
  if (!value) return false;
  return value.includes("api.x.ai");
}

export function normalizeBackendMode(value: unknown): OrgBackendMode {
  return value === "custom" ? "custom" : "platform";
}

export function normalizeProvider(
  value: unknown,
  baseUrl?: string | null,
): OrgBackendProvider | null {
  if (value === "xai" || value === "openai-compatible") return value;
  if (isXaiBaseUrl(baseUrl)) return "xai";
  if (typeof baseUrl === "string" && baseUrl.trim()) return "openai-compatible";
  return null;
}

export function secretLastFour(secret: string | null | undefined): string | null {
  const value = String(secret || "").trim();
  if (!value) return null;
  return value.slice(-4);
}

export function filesApiRoot(baseURL: string | null | undefined): string {
  const trimmed = trimSlash(String(baseURL || DEFAULT_XAI_FILES_BASE_URL).trim() || DEFAULT_XAI_FILES_BASE_URL);
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

export function emptyOrgBackendStored(): OrgBackendStored {
  return {
    llm_backend: "platform",
    llm_provider: null,
    llm_base_url: null,
    llm_api_key_ciphertext: null,
    llm_api_key_last_four: null,
    llm_model: null,
    blob_backend: "platform",
    blob_provider: null,
    blob_base_url: null,
    blob_api_key_ciphertext: null,
    blob_api_key_last_four: null,
    openrouter_api_key_ciphertext: null,
    openrouter_api_key_last_four: null,
  };
}

export function readOrgBackendStored(row: OrgBackendRecord | null | undefined): OrgBackendStored {
  const empty = emptyOrgBackendStored();
  if (!row) return empty;
  return {
    llm_backend: normalizeBackendMode(row.llm_backend),
    llm_provider: normalizeProvider(row.llm_provider, row.llm_base_url),
    llm_base_url: typeof row.llm_base_url === "string" && row.llm_base_url.trim() ? trimSlash(row.llm_base_url.trim()) : null,
    llm_api_key_ciphertext: typeof row.llm_api_key_ciphertext === "string" && row.llm_api_key_ciphertext ? row.llm_api_key_ciphertext : null,
    llm_api_key_last_four: typeof row.llm_api_key_last_four === "string" && row.llm_api_key_last_four.trim() ? row.llm_api_key_last_four.trim() : null,
    llm_model: typeof row.llm_model === "string" && row.llm_model.trim() ? row.llm_model.trim() : null,
    blob_backend: normalizeBackendMode(row.blob_backend),
    blob_provider: normalizeProvider(row.blob_provider, row.blob_base_url),
    blob_base_url: typeof row.blob_base_url === "string" && row.blob_base_url.trim() ? trimSlash(row.blob_base_url.trim()) : null,
    blob_api_key_ciphertext: typeof row.blob_api_key_ciphertext === "string" && row.blob_api_key_ciphertext ? row.blob_api_key_ciphertext : null,
    blob_api_key_last_four: typeof row.blob_api_key_last_four === "string" && row.blob_api_key_last_four.trim() ? row.blob_api_key_last_four.trim() : null,
    openrouter_api_key_ciphertext:
      typeof row.openrouter_api_key_ciphertext === "string" && row.openrouter_api_key_ciphertext
        ? row.openrouter_api_key_ciphertext
        : null,
    openrouter_api_key_last_four:
      typeof row.openrouter_api_key_last_four === "string" && row.openrouter_api_key_last_four.trim()
        ? row.openrouter_api_key_last_four.trim()
        : null,
  };
}

export function orgLlmIsXai(
  org: OrgBackendRecord | null | undefined,
  platform: Pick<OrgChatConfig, "baseURL"> = { baseURL: DEFAULT_XAI_CHAT_BASE_URL },
): boolean {
  const stored = readOrgBackendStored(org);
  if (stored.llm_backend === "custom") {
    if (stored.llm_provider === "xai") return true;
    return isXaiBaseUrl(stored.llm_base_url);
  }
  return isXaiBaseUrl(platform.baseURL);
}

export function sessionCreditCostForOrg(
  org: OrgBackendRecord | null | undefined,
  platform: Pick<OrgChatConfig, "baseURL"> = { baseURL: DEFAULT_XAI_CHAT_BASE_URL },
): number {
  return flowSessionCreditCost(undefined, { llmIsXai: orgLlmIsXai(org, platform) });
}

export function platformChatConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): OrgChatConfig {
  const baseURL = trimSlash(env.AI_BASE_URL?.trim() || DEFAULT_XAI_CHAT_BASE_URL);
  const apiKey = env.AI_API_KEY?.trim() || env.XAI_API_KEY?.trim() || null;
  return {
    baseURL,
    apiKey,
    model: env.AI_MODEL?.trim() || DEFAULT_MODEL,
    canvasAskModel: env.AI_CANVAS_ASK_MODEL?.trim() || CANVAS_ASK_MODEL,
    canvasCommandModel: env.AI_CANVAS_COMMAND_MODEL?.trim() || CANVAS_COMMAND_MODEL,
  };
}

export function platformBlobConfigFromEnv(
  env: NodeJS.ProcessEnv = process.env,
): BlobStoreConfig {
  const kind = (env.BLOB_STORE || "xai").trim().toLowerCase() || "xai";
  const apiKey = env.AI_API_KEY?.trim() || env.XAI_API_KEY?.trim() || null;
  return {
    kind,
    baseURL: kind === "xai" ? DEFAULT_XAI_FILES_BASE_URL : null,
    apiKey,
    dir: env.BLOB_STORE_DIR?.trim() || null,
  };
}

export function resolveOrgChatConfig(
  org: OrgBackendRecord | null | undefined,
  platform: OrgChatConfig,
  secrets: { llmApiKey?: string | null } = {},
): OrgChatConfig {
  const stored = readOrgBackendStored(org);
  const customKey = String(secrets.llmApiKey || "").trim();
  if (stored.llm_backend !== "custom" || !customKey) {
    return { ...platform };
  }
  const provider =
    stored.llm_provider || (isXaiBaseUrl(stored.llm_base_url) ? "xai" : "openai-compatible");
  const baseURL = trimSlash(
    stored.llm_base_url || (provider === "xai" ? DEFAULT_XAI_CHAT_BASE_URL : platform.baseURL),
  );
  return {
    ...platform,
    baseURL,
    apiKey: customKey,
    model: stored.llm_model || platform.model,
  };
}

export function resolveOrgBlobConfig(
  org: OrgBackendRecord | null | undefined,
  platform: BlobStoreConfig,
  secrets: { blobApiKey?: string | null } = {},
): BlobStoreConfig {
  const stored = readOrgBackendStored(org);
  const customKey = String(secrets.blobApiKey || "").trim();
  if (stored.blob_backend !== "custom" || !customKey) {
    return { ...platform };
  }
  const provider =
    stored.blob_provider || (isXaiBaseUrl(stored.blob_base_url) ? "xai" : "openai-compatible");
  const baseURL = trimSlash(
    stored.blob_base_url ||
      (provider === "xai" ? DEFAULT_XAI_FILES_BASE_URL : platform.baseURL || DEFAULT_XAI_FILES_BASE_URL),
  );
  return {
    kind: provider === "xai" ? "xai" : "openai-compatible",
    baseURL,
    apiKey: customKey,
    dir: null,
  };
}

export function resolveOrgRuntime(
  org: OrgBackendRecord | null | undefined,
  platformChat: OrgChatConfig,
  platformBlob: BlobStoreConfig,
  secrets: { llmApiKey?: string | null; blobApiKey?: string | null } = {},
): OrgBackendRuntime {
  const chat = resolveOrgChatConfig(org, platformChat, secrets);
  const blob = resolveOrgBlobConfig(org, platformBlob, secrets);
  const usedOrgChat = readOrgBackendStored(org).llm_backend === "custom" && Boolean(String(secrets.llmApiKey || "").trim());
  const usedOrgBlob = readOrgBackendStored(org).blob_backend === "custom" && Boolean(String(secrets.blobApiKey || "").trim());
  const llmIsXai = isXaiBaseUrl(chat.baseURL);
  return {
    chat,
    blob,
    llmIsXai,
    sessionCreditCost: flowSessionCreditCost(undefined, { llmIsXai }),
    source: usedOrgChat || usedOrgBlob ? "org" : "platform",
  };
}

export function presentOrgBackends(
  org: OrgBackendRecord | null | undefined,
  platform: Pick<OrgChatConfig, "baseURL"> = { baseURL: DEFAULT_XAI_CHAT_BASE_URL },
): OrgBackendPublic {
  const stored = readOrgBackendStored(org);
  const llmIsXai = orgLlmIsXai(stored, platform);
  return {
    llm: {
      mode: stored.llm_backend,
      provider: stored.llm_backend === "custom" ? stored.llm_provider : "xai",
      baseUrl: stored.llm_backend === "custom" ? stored.llm_base_url : DEFAULT_XAI_CHAT_BASE_URL,
      model: stored.llm_model,
      configured: Boolean(stored.llm_api_key_ciphertext || stored.llm_api_key_last_four),
      lastFour: stored.llm_api_key_last_four,
    },
    blob: {
      mode: stored.blob_backend,
      provider: stored.blob_backend === "custom" ? stored.blob_provider : "xai",
      baseUrl: stored.blob_backend === "custom" ? stored.blob_base_url : DEFAULT_XAI_FILES_BASE_URL,
      configured: Boolean(stored.blob_api_key_ciphertext || stored.blob_api_key_last_four),
      lastFour: stored.blob_api_key_last_four,
    },
    openrouter: {
      configured: Boolean(stored.openrouter_api_key_ciphertext || stored.openrouter_api_key_last_four),
      lastFour: stored.openrouter_api_key_last_four,
    },
    llmIsXai,
    sessionCreditCost: flowSessionCreditCost(undefined, { llmIsXai }),
  };
}

export function omitOrgSecretColumns<T extends Record<string, unknown>>(
  row: T,
): Omit<T, (typeof ORG_SECRET_COLUMNS)[number]> {
  const next = { ...row } as T & Record<string, unknown>;
  for (const column of ORG_SECRET_COLUMNS) {
    delete next[column];
  }
  return next as Omit<T, (typeof ORG_SECRET_COLUMNS)[number]>;
}

export function presentOrganizationRow<T extends Record<string, unknown>>(
  row: T,
  platform: Pick<OrgChatConfig, "baseURL"> = { baseURL: DEFAULT_XAI_CHAT_BASE_URL },
): Omit<T, (typeof ORG_SECRET_COLUMNS)[number]> & { backends: OrgBackendPublic } {
  const redacted = omitOrgSecretColumns(row);
  return {
    ...redacted,
    backends: presentOrgBackends(row as OrgBackendRecord, platform),
  };
}

export function authorizeOrgBackendEdit(
  profile: OrgBackendActor | null | undefined,
): OrgBackendGuard {
  const organizationId = String(profile?.organization_id || "").trim();
  if (!organizationId) {
    return { ok: false, error: "Organization not found", status: 404 };
  }
  if (profile?.is_org_admin !== true) {
    return {
      ok: false,
      error: "Only organization admins can update model and storage backends",
      status: 403,
    };
  }
  return { ok: true, organizationId };
}

function asOptionalString(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function parseEndpoint(
  raw: unknown,
  label: "llm" | "blob",
): ParsedOrgBackendMutation["llm"] | { error: string } | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { error: `${label} must be an object` };
  }
  const body = raw as Record<string, unknown>;
  if (
    "api_key_ciphertext" in body ||
    "ciphertext" in body ||
    "llm_api_key_ciphertext" in body ||
    "blob_api_key_ciphertext" in body
  ) {
    return { error: "Sealed keys cannot be written from the client" };
  }
  const mode = normalizeBackendMode(body.mode);
  const provider = normalizeProvider(body.provider, asOptionalString(body.baseUrl));
  const baseUrl = asOptionalString(body.baseUrl);
  const apiKey = asOptionalString(body.apiKey);
  const model = asOptionalString(body.model);
  const clearKey = body.clearKey === true;
  if (mode === "custom") {
    if (!provider) {
      return { error: `${label} provider is required when using your own key` };
    }
    if (provider === "openai-compatible" && !baseUrl) {
      return { error: `${label} API base URL is required for OpenAI-compatible backends` };
    }
  }
  return {
    mode,
    provider: mode === "custom" ? provider : null,
    baseUrl: mode === "custom" ? baseUrl : null,
    apiKey,
    model: label === "llm" ? model : null,
    clearKey,
  };
}

export function parseOrgBackendMutation(
  body: unknown,
): { ok: true; value: ParsedOrgBackendMutation } | { ok: false; error: string; status: number } {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, error: "JSON object required", status: 400 };
  }
  const raw = body as OrgBackendPatchInput & Record<string, unknown>;
  if (
    typeof raw.llm_api_key_ciphertext === "string" ||
    typeof raw.blob_api_key_ciphertext === "string" ||
    typeof raw.openrouter_api_key_ciphertext === "string" ||
    typeof raw.xai_api_key_ciphertext === "string"
  ) {
    return { ok: false, error: "Sealed keys cannot be written from the client", status: 400 };
  }
  const llm = parseEndpoint(raw.llm, "llm");
  if (llm && "error" in llm) return { ok: false, error: llm.error, status: 400 };
  const blob = parseEndpoint(raw.blob, "blob");
  if (blob && "error" in blob) return { ok: false, error: blob.error, status: 400 };
  const openrouter = parseOpenRouter(raw.openrouter);
  if (openrouter && "error" in openrouter) return { ok: false, error: openrouter.error, status: 400 };
  if (!llm && !blob && !openrouter) {
    return { ok: false, error: "llm, blob, or openrouter is required", status: 400 };
  }
  return { ok: true, value: { llm, blob, openrouter } };
}

function parseOpenRouter(
  raw: unknown,
): ParsedOrgBackendMutation["openrouter"] | { error: string } | undefined {
  if (raw == null) return undefined;
  if (typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "openrouter must be an object" };
  }
  const body = raw as Record<string, unknown>;
  if (
    "api_key_ciphertext" in body ||
    "ciphertext" in body ||
    "openrouter_api_key_ciphertext" in body
  ) {
    return { error: "Sealed keys cannot be written from the client" };
  }
  return {
    apiKey: asOptionalString(body.apiKey),
    clearKey: body.clearKey === true,
  };
}

export function applyOrgBackendMutation(
  current: OrgBackendRecord | null | undefined,
  input: ParsedOrgBackendMutation,
  seal: (plaintext: string) => string,
): { ok: true; next: OrgBackendStored } | { ok: false; error: string; status: number } {
  const next = readOrgBackendStored(current);

  if (input.llm) {
    if (input.llm.mode === "platform") {
      next.llm_backend = "platform";
      next.llm_provider = null;
      next.llm_base_url = null;
      next.llm_api_key_ciphertext = null;
      next.llm_api_key_last_four = null;
      next.llm_model = null;
    } else {
      const provider = input.llm.provider || "openai-compatible";
      const baseUrl =
        input.llm.baseUrl || (provider === "xai" ? DEFAULT_XAI_CHAT_BASE_URL : null);
      if (provider === "openai-compatible" && !baseUrl) {
        return { ok: false, error: "llm API base URL is required for OpenAI-compatible backends", status: 400 };
      }
      const keepExisting = Boolean(next.llm_api_key_ciphertext) && !input.llm.clearKey;
      const apiKey = input.llm.apiKey;
      if (!apiKey && !keepExisting) {
        return { ok: false, error: "llm API key is required", status: 400 };
      }
      next.llm_backend = "custom";
      next.llm_provider = provider;
      next.llm_base_url = baseUrl ? trimSlash(baseUrl) : null;
      next.llm_model = input.llm.model;
      if (apiKey) {
        next.llm_api_key_ciphertext = seal(apiKey);
        next.llm_api_key_last_four = secretLastFour(apiKey);
      }
    }
  }

  if (input.blob) {
    if (input.blob.mode === "platform") {
      next.blob_backend = "platform";
      next.blob_provider = null;
      next.blob_base_url = null;
      next.blob_api_key_ciphertext = null;
      next.blob_api_key_last_four = null;
    } else {
      const provider = input.blob.provider || "openai-compatible";
      const baseUrl =
        input.blob.baseUrl || (provider === "xai" ? DEFAULT_XAI_FILES_BASE_URL : null);
      if (provider === "openai-compatible" && !baseUrl) {
        return { ok: false, error: "blob API base URL is required for OpenAI-compatible backends", status: 400 };
      }
      const keepExisting = Boolean(next.blob_api_key_ciphertext) && !input.blob.clearKey;
      const apiKey = input.blob.apiKey;
      if (!apiKey && !keepExisting) {
        return { ok: false, error: "blob API key is required", status: 400 };
      }
      next.blob_backend = "custom";
      next.blob_provider = provider;
      next.blob_base_url = baseUrl ? trimSlash(baseUrl) : null;
      if (apiKey) {
        next.blob_api_key_ciphertext = seal(apiKey);
        next.blob_api_key_last_four = secretLastFour(apiKey);
      }
    }
  }

  if (input.openrouter) {
    if (input.openrouter.clearKey && !input.openrouter.apiKey) {
      next.openrouter_api_key_ciphertext = null;
      next.openrouter_api_key_last_four = null;
    } else if (input.openrouter.apiKey) {
      next.openrouter_api_key_ciphertext = seal(input.openrouter.apiKey);
      next.openrouter_api_key_last_four = secretLastFour(input.openrouter.apiKey);
    }
  }

  return { ok: true, next };
}

export function orgBackendUpdateRow(stored: OrgBackendStored): OrgBackendStored & { updated_at: string } {
  return {
    ...stored,
    updated_at: new Date().toISOString(),
  };
}
