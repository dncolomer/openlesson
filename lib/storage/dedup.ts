// Content-based save deduplication for heartbeats
import type { DeduplicatedSaveResult } from "@/lib/domain/types";

// ============================================
// CONTENT-BASED DEDUPLICATION
// Avoids saving unchanged data during heartbeats
// ============================================

interface DeduplicatorCache {
  [key: string]: string;
}

const MAX_DEDUP_CACHE_SIZE = 100;
const deduplicatorCache: DeduplicatorCache = {};

/** Evict oldest entries when cache exceeds MAX_DEDUP_CACHE_SIZE */
function evictDedupCache(): void {
  const keys = Object.keys(deduplicatorCache);
  if (keys.length > MAX_DEDUP_CACHE_SIZE) {
    // Remove the first (oldest) entries to get back under the limit
    const toRemove = keys.slice(0, keys.length - MAX_DEDUP_CACHE_SIZE);
    for (const key of toRemove) {
      delete deduplicatorCache[key];
    }
  }
}

async function hashContent(content: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(content);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function saveWithDedupString(
  content: string,
  key: string
): Promise<DeduplicatedSaveResult> {
  const hash = await hashContent(content);

  if (deduplicatorCache[key] === hash) {
    return { saved: false, skipped: true, hash };
  }

  deduplicatorCache[key] = hash;
  evictDedupCache();
  return { saved: true, skipped: false, hash };
}

export async function saveWithDedupBlob(
  blob: Blob,
  key: string
): Promise<DeduplicatedSaveResult> {
  const arrayBuffer = await blob.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest("SHA-256", arrayBuffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hash = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  if (deduplicatorCache[key] === hash) {
    return { saved: false, skipped: true, hash };
  }

  deduplicatorCache[key] = hash;
  evictDedupCache();
  return { saved: true, skipped: false, hash };
}

export function clearDedupCache(): void {
  Object.keys(deduplicatorCache).forEach((key) => delete deduplicatorCache[key]);
  console.log("[Deduplicator] Cache cleared");
}

export function getDedupCacheSize(): number {
  return Object.keys(deduplicatorCache).length;
}
