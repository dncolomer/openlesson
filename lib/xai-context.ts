/**
 * Request-scoped xAI credentials (org API key).
 *
 * Uses Node AsyncLocalStorage when available. Avoids a static `async_hooks`
 * import so this module never breaks client/edge bundling if pulled in by
 * mistake. Prefer keeping call sites server-only.
 */

export type ContextualChatConfig = {
  baseURL: string;
  apiKey: string | null;
  model: string;
  canvasAskModel: string;
  canvasCommandModel: string;
};

type XaiRequestContext = {
  organizationId: string | null;
  apiKey: string | null;
  chatConfig?: ContextualChatConfig | null;
  blobKind?: string | null;
  blobBaseURL?: string | null;
  blobApiKey?: string | null;
};

type StorageLike = {
  run: <T>(ctx: XaiRequestContext, fn: () => T) => T;
  getStore: () => XaiRequestContext | undefined;
  enterWith: (ctx: XaiRequestContext) => void;
};

const noopStorage: StorageLike = {
  run: <T>(_ctx: XaiRequestContext, fn: () => T) => fn(),
  getStore: () => undefined,
  enterWith: () => {},
};

function createStorage(): StorageLike {
  try {
    // Dynamic require so bundlers do not resolve async_hooks for client/edge.
    // Avoid Node version probes; Turbopack treats those as an Edge Node API.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require("async_hooks") as typeof import("async_hooks");
    const als = new AsyncLocalStorage<XaiRequestContext>();
    return {
      run: (ctx, fn) => als.run(ctx, fn),
      getStore: () => als.getStore(),
      enterWith: (ctx) => {
        if (typeof als.enterWith === "function") als.enterWith(ctx);
      },
    };
  } catch {
    return noopStorage;
  }
}

const globalAls = globalThis as typeof globalThis & {
  __openlessonXaiStorage?: StorageLike;
};
const storage =
  globalAls.__openlessonXaiStorage ??
  (globalAls.__openlessonXaiStorage = createStorage());

/** Run fn with org-scoped xAI credentials visible to nested callXai/getApiKey helpers. */
export function runWithXaiContext<T>(ctx: XaiRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

/** Bind org backends for the rest of this async request (Node enterWith). */
export function enterXaiContext(ctx: XaiRequestContext): void {
  storage.enterWith(ctx);
}

export function getXaiContext(): XaiRequestContext | undefined {
  return storage.getStore();
}

export function getContextualXaiApiKey(): string | null {
  const store = storage.getStore();
  return store?.chatConfig?.apiKey ?? store?.apiKey ?? null;
}

export function getContextualChatConfig(): ContextualChatConfig | null {
  return storage.getStore()?.chatConfig ?? null;
}

export function getContextualBlobApiKey(): string | null {
  const store = storage.getStore();
  return store?.blobApiKey ?? store?.apiKey ?? null;
}

export function getContextualBlobBaseURL(): string | null {
  const value = storage.getStore()?.blobBaseURL;
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getContextualBlobKind(): string | null {
  const value = storage.getStore()?.blobKind;
  return typeof value === "string" && value.trim() ? value.trim().toLowerCase() : null;
}
