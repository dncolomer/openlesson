/**
 * xAI Files adapter for BlobStore.
 * Collection attach stays with the org-scoped upload helper in this PR.
 */
import type { BlobStore } from "@/lib/ai/blob-store";
import { bytesToBase64 } from "@/lib/ai/bytes";
import {
  deleteFileFromXAI,
  getFileContentResponse,
  getFileMetadata,
  uploadFileToXAI,
} from "@/lib/xai-files";

function apiKeyFromFields(fields?: Record<string, string>): string | null {
  const key = fields?.apiKey?.trim();
  return key || null;
}

export const xaiBlobStore: BlobStore = {
  async put(input) {
    const uploaded = await uploadFileToXAI(
      input.name,
      input.mimeType,
      bytesToBase64(input.bytes),
      { apiKey: apiKeyFromFields(input.fields) },
    );
    return { id: uploaded.file_id };
  },

  async get(id, fields) {
    const res = await getFileContentResponse(id, {
      apiKey: apiKeyFromFields(fields),
    });
    const buf = Buffer.from(await res.arrayBuffer());
    return {
      bytes: new Uint8Array(buf),
      mimeType: res.headers.get("content-type") || "application/octet-stream",
      name: id,
      status: res.status,
    };
  },

  async delete(id, fields) {
    return deleteFileFromXAI(id, { apiKey: apiKeyFromFields(fields) });
  },

  async exists(id, fields) {
    const meta = await getFileMetadata(id, {
      apiKey: apiKeyFromFields(fields),
    });
    return Boolean(meta);
  },
};
