/**
 * On-disk BlobStore (`BLOB_STORE=fs`, `BLOB_STORE_DIR=...`).
 * Ids are `fs_<uuid>`. Metadata sits next to the bytes as `{id}.json`.
 */
import { randomUUID } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import type { BlobStore } from "@/lib/ai/blob-store";

const FS_ID_RE =
  /^fs_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function toBytes(input: Uint8Array | Buffer | string): Uint8Array {
  if (typeof input === "string") return new Uint8Array(Buffer.from(input, "base64"));
  return new Uint8Array(input);
}

function isFsId(id: string): boolean {
  return FS_ID_RE.test(id);
}

export function createFilesystemBlobStore(rootDir: string): BlobStore {
  const root = path.resolve(rootDir);

  function pathsFor(id: string) {
    return {
      bin: path.join(root, `${id}.bin`),
      meta: path.join(root, `${id}.json`),
    };
  }

  return {
    async put(input) {
      await fs.mkdir(root, { recursive: true });
      const id = `fs_${randomUUID()}`;
      const { bin, meta } = pathsFor(id);
      await fs.writeFile(bin, Buffer.from(toBytes(input.bytes)));
      await fs.writeFile(
        meta,
        JSON.stringify({ name: input.name, mimeType: input.mimeType }),
      );
      return { id };
    },

    async get(id) {
      if (!isFsId(id)) {
        return {
          bytes: new Uint8Array(),
          mimeType: "text/plain",
          name: id,
          status: 404,
        };
      }
      const { bin, meta } = pathsFor(id);
      try {
        const bytes = new Uint8Array(await fs.readFile(bin));
        let name = id;
        let mimeType = "application/octet-stream";
        try {
          const parsed = JSON.parse(await fs.readFile(meta, "utf8")) as {
            name?: unknown;
            mimeType?: unknown;
          };
          if (typeof parsed.name === "string" && parsed.name.trim()) name = parsed.name;
          if (typeof parsed.mimeType === "string" && parsed.mimeType.trim()) {
            mimeType = parsed.mimeType;
          }
        } catch {
          /* missing sidecar */
        }
        return { bytes, mimeType, name, status: 200 };
      } catch {
        return {
          bytes: new Uint8Array(),
          mimeType: "text/plain",
          name: id,
          status: 404,
        };
      }
    },

    async delete(id) {
      if (!isFsId(id)) return false;
      const { bin, meta } = pathsFor(id);
      let removed = false;
      for (const filePath of [bin, meta]) {
        try {
          await fs.unlink(filePath);
          removed = true;
        } catch {
          /* already gone */
        }
      }
      return removed;
    },

    async exists(id) {
      if (!isFsId(id)) return false;
      try {
        await fs.access(pathsFor(id).bin);
        return true;
      } catch {
        return false;
      }
    },
  };
}
