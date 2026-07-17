/**
 * Request-scoped xAI credentials (org API key).
 *
 * Uses Node AsyncLocalStorage when available. Avoids a static `async_hooks`
 * import so this module never breaks client/edge bundling if pulled in by
 * mistake. Prefer keeping call sites server-only.
 */

type XaiRequestContext = {
  organizationId: string | null;
  apiKey: string | null;
};

type StorageLike = {
  run: <T>(ctx: XaiRequestContext, fn: () => T) => T;
  getStore: () => XaiRequestContext | undefined;
};

const noopStorage: StorageLike = {
  run: <T>(_ctx: XaiRequestContext, fn: () => T) => fn(),
  getStore: () => undefined,
};

function createStorage(): StorageLike {
  // Browser / non-Node: no request-scoped context.
  if (typeof process === "undefined" || !process.versions?.node) {
    return noopStorage;
  }
  try {
    // Dynamic require so bundlers do not resolve async_hooks for client builds.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { AsyncLocalStorage } = require("async_hooks") as typeof import("async_hooks");
    return new AsyncLocalStorage<XaiRequestContext>();
  } catch {
    return noopStorage;
  }
}

const storage = createStorage();

/** Run fn with org-scoped xAI credentials visible to nested callXai/getApiKey helpers. */
export function runWithXaiContext<T>(ctx: XaiRequestContext, fn: () => T): T {
  return storage.run(ctx, fn);
}

export function getXaiContext(): XaiRequestContext | undefined {
  return storage.getStore();
}

export function getContextualXaiApiKey(): string | null {
  return storage.getStore()?.apiKey ?? null;
}
