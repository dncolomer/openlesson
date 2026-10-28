/**
 * Content-block file bytes: org-scoped xAI Files, pointer on blocks.map_block.
 */

import type { MapBlockAttachment } from "@/lib/block-kind";
import {
  HELIOS_MAP_FILE_ACCEPT,
  HELIOS_MAP_MAX_FILE_BYTES,
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
} from "@/lib/workspace-helios-files";

export const MAP_BLOCK_FILES_PATH = "/api/workspace/map-block-files";
export const MAP_BLOCK_FILE_ACCEPT = HELIOS_MAP_FILE_ACCEPT;
export const MAP_BLOCK_MAX_FILE_BYTES = HELIOS_MAP_MAX_FILE_BYTES;
export const MAP_BLOCK_MAX_ATTACHMENTS = 20;

export function mapBlockFileDownloadPath(
  workspaceId: string,
  fileId: string,
  opts?: {
    ayclToken?: string | null;
    name?: string | null;
    mimeType?: string | null;
  },
): string {
  const params = new URLSearchParams({
    workspaceId: String(workspaceId || "").trim(),
    fileId: String(fileId || "").trim(),
  });
  const token = String(opts?.ayclToken || "").trim();
  if (token) params.set("ayclToken", token);
  const name = String(opts?.name || "").trim();
  if (name) params.set("name", name);
  const mimeType = String(opts?.mimeType || "").trim();
  if (mimeType) params.set("mimeType", mimeType);
  return `${MAP_BLOCK_FILES_PATH}?${params.toString()}`;
}

export function mapBlockAttachmentHref(
  item: Pick<MapBlockAttachment, "type" | "url" | "xaiFileId" | "name" | "mimeType">,
  opts?: { workspaceId?: string | null; ayclToken?: string | null },
): string | null {
  const workspaceId = String(opts?.workspaceId || "").trim();
  const fileId = String(item.xaiFileId || "").trim();
  if (fileId && workspaceId) {
    return mapBlockFileDownloadPath(workspaceId, fileId, {
      ayclToken: opts?.ayclToken,
      name: item.name,
      mimeType: item.mimeType,
    });
  }
  const url = String(item.url || "").trim();
  return url || null;
}

export function mapBlockFileFromUpload(input: {
  name: string;
  mimeType?: string;
  xaiFileId: string;
  workspaceId: string;
}): MapBlockAttachment {
  const name = String(input.name || "").trim() || "file";
  const xaiFileId = String(input.xaiFileId || "").trim();
  const mimeType = String(input.mimeType || "").trim() || undefined;
  return {
    type: "file",
    name,
    ...(mimeType ? { mimeType } : {}),
    xaiFileId,
    url: mapBlockFileDownloadPath(input.workspaceId, xaiFileId, {
      name,
      mimeType,
    }),
  };
}

async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(binary);
}

export async function uploadMapBlockFile(input: {
  workspaceId: string;
  ayclToken?: string | null;
  file: File;
}): Promise<MapBlockAttachment> {
  const workspaceId = String(input.workspaceId || "").trim();
  if (!workspaceId) throw new Error("Workspace is required");
  const mimeType = normalizeHeliosFileMime(input.file.name, input.file.type);
  if (!isHeliosAllowedMimeType(mimeType)) {
    throw new Error("That file type is not supported.");
  }
  if (input.file.size > MAP_BLOCK_MAX_FILE_BYTES) {
    throw new Error("File is too large (10 MB).");
  }
  const data = await fileToBase64(input.file);
  const res = await fetch(MAP_BLOCK_FILES_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      workspaceId,
      ...(input.ayclToken ? { ayclToken: input.ayclToken } : {}),
      fileName: input.file.name,
      mimeType,
      data,
    }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = body && typeof body === "object" ? (body as { error?: unknown }).error : null;
    const message =
      typeof err === "string"
        ? err
        : err && typeof err === "object" && typeof (err as { message?: unknown }).message === "string"
          ? String((err as { message: string }).message)
          : "Could not upload file";
    throw new Error(message);
  }
  const xaiFileId = String(
    (body as { xaiFileId?: unknown; xai_file_id?: unknown }).xaiFileId ??
      (body as { xai_file_id?: unknown }).xai_file_id ??
      "",
  ).trim();
  if (!xaiFileId) throw new Error("Upload did not return a file id");
  return mapBlockFileFromUpload({
    name: input.file.name,
    mimeType,
    xaiFileId,
    workspaceId,
  });
}
