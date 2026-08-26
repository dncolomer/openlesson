/**
 * TAPBench public benchmark: public workspaces owned by this account are Tasks.
 * Timed Stash/Submit sessions remain at /tapbench/[token]; this module is the
 * 64D region-score benchmark LP + wrap API.
 */

export const TAPBENCH_OWNER_EMAIL = "tapbench@uncertain.systems" as const;

/** Catalog, goals, keys, skill, results. Live traces go through Stash. */
export const TAPBENCH_API_BASE = "/api/v3/tapbench" as const;

export const TAPBENCH_KEY_PREFIX = "tbk_" as const;

export const TAPBENCH_POW_WRAP_SOURCE = "tapbench_wrap" as const;

export const TAPBENCH_STASH_ONLY_MESSAGE =
  "TAPBench keys use the Stash API (buffer, stash, submit). Direct proof-of-work dump is closed.";
