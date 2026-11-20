/**
 * Object-storage port for PoW traces, flow artifacts, transcripts, and sensors.
 * Default adapter is xAI Files (`BLOB_STORE` unset or `xai`).
 */
import { xaiBlobStore } from "@/lib/ai/xai-blob-store";
import { createFilesystemBlobStore } from "@/lib/ai/fs-blob-store";
import { bytesToBase64 } from "@/lib/ai/bytes";
import { getContextualBlobKind } from "@/lib/xai-context";
export type BlobPutInput = {
  name: string;
  mimeType: string;
  /** Raw bytes, or a base64 string (legacy uploadOrgScopedXaiFile callers). */
  bytes: Uint8Array | Buffer | string;
  fields?: Record<string, string>;
};

export type BlobPutResult = {
  id: string;
};

export type BlobGetResult = {
  bytes: Uint8Array;
  mimeType: string;
  name: string;
  status: number;
};

export type BlobStore = {
  put(input: BlobPutInput): Promise<BlobPutResult>;
  get(id: string, fields?: Record<string, string>): Promise<BlobGetResult>;
  delete(id: string, fields?: Record<string, string>): Promise<boolean>;
  exists(id: string, fields?: Record<string, string>): Promise<boolean>;
};

let storeOverride: BlobStore | null = null;

export function setBlobStoreForTests(store: BlobStore | null): void {
  storeOverride = store;
}

export function blobStoreKind(): string {
  const contextual = getContextualBlobKind();
  if (contextual) return contextual;
  return (process.env.BLOB_STORE || "xai").trim().toLowerCase() || "xai";
}

export function isXaiBlobStore(): boolean {
  return blobStoreKind() === "xai";
}

export function getBlobStore(): BlobStore {
  if (storeOverride) return storeOverride;
  const kind = blobStoreKind();
  if (kind === "xai" || kind === "openai-compatible") return xaiBlobStore;
  if (kind === "memory") return createMemoryBlobStore();
  if (kind === "fs") {
    const dir = process.env.BLOB_STORE_DIR?.trim();
    if (!dir) {
      throw new Error("BLOB_STORE=fs requires BLOB_STORE_DIR");
    }
    return createFilesystemBlobStore(dir);
  }
  throw new Error(
    `Unknown BLOB_STORE=${kind}. Use xai (default), openai-compatible, memory, or fs.`,
  );
}

export { bytesToBase64 };

export function createMemoryBlobStore(): BlobStore {
  const files = new Map<
    string,
    { bytes: Uint8Array; mimeType: string; name: string }
  >();
  let n = 0;
  return {
    async put(input) {
      n += 1;
      const id = `mem_${n}`;
      const raw =
        typeof input.bytes === "string"
          ? Buffer.from(input.bytes, "base64")
          : Buffer.from(input.bytes);
      files.set(id, {
        bytes: new Uint8Array(raw),
        mimeType: input.mimeType,
        name: input.name,
      });
      return { id };
    },
    async get(id) {
      const row = files.get(id);
      if (!row) {
        return {
          bytes: new Uint8Array(),
          mimeType: "text/plain",
          name: id,
          status: 404,
        };
      }
      return { ...row, status: 200 };
    },
    async delete(id) {
      return files.delete(id);
    },
    async exists(id) {
      return files.has(id);
    },
  };
}
