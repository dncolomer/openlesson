/**
 * File artifacts linked on Solve / Verification / Calibration flows.
 * Bytes live on org-scoped xAI Files; the flow stores name, mime, file id.
 */

import {
  HELIOS_MAP_FILE_ACCEPT,
  HELIOS_MAP_MAX_FILE_BYTES,
  isHeliosAllowedMimeType,
  normalizeHeliosFileMime,
} from "@/lib/workspace-helios-files";

export const FLOW_ARTIFACTS_PATH = "/api/dashboard/flows/files";
export const FLOW_ARTIFACT_ACCEPT = HELIOS_MAP_FILE_ACCEPT;
export const FLOW_ARTIFACT_MAX_BYTES = HELIOS_MAP_MAX_FILE_BYTES;
export const FLOW_ARTIFACT_MAX_COUNT = 20;

const XAI_FILE_ID_RE =
  /^file_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type FlowArtifact = {
  name: string;
  mimeType?: string;
  xaiFileId: string;
};

export function isFlowArtifactFileId(value: unknown): value is string {
  return typeof value === "string" && XAI_FILE_ID_RE.test(value.trim());
}

export function parseFlowArtifact(raw: unknown): FlowArtifact | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const rec = raw as Record<string, unknown>;
  const name = String(rec.name ?? rec.fileName ?? rec.file_name ?? "").trim();
  const xaiFileId = String(
    rec.xaiFileId ?? rec.xai_file_id ?? rec.fileId ?? rec.file_id ?? "",
  ).trim();
  if (!name || !isFlowArtifactFileId(xaiFileId)) return null;
  const mimeType = String(rec.mimeType ?? rec.mime_type ?? "").trim();
  return {
    name,
    xaiFileId,
    ...(mimeType ? { mimeType } : {}),
  };
}

export function parseFlowArtifacts(raw: unknown): FlowArtifact[] {
  if (!Array.isArray(raw)) return [];
  const out: FlowArtifact[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    const parsed = parseFlowArtifact(item);
    if (!parsed) continue;
    if (seen.has(parsed.xaiFileId)) continue;
    seen.add(parsed.xaiFileId);
    out.push(parsed);
    if (out.length >= FLOW_ARTIFACT_MAX_COUNT) break;
  }
  return out;
}

export function flowArtifactFileIds(artifacts: readonly FlowArtifact[] | null | undefined): string[] {
  return (artifacts ?? [])
    .map((item) => item.xaiFileId)
    .filter((id) => isFlowArtifactFileId(id));
}

export function flowProblemFromUnknown(input: {
  problem?: unknown;
  topic?: unknown;
  goal?: unknown;
}): string {
  return (
    String(input.problem ?? "").trim() ||
    String(input.topic ?? "").trim() ||
    String(input.goal ?? "").trim()
  );
}

/** Public runners still read a question pool; authoring stores one Problem. */
export function flowProblemQuestionPool(problem: string): { id: string; text: string }[] {
  const text = String(problem || "").trim();
  if (!text) return [];
  return [{ id: "q-1", text }];
}

export function serializeFlowArtifacts(artifacts: readonly FlowArtifact[]): Array<{
  name: string;
  mimeType?: string;
  xaiFileId: string;
}> {
  return parseFlowArtifacts(artifacts).map((item) => ({
    name: item.name,
    xaiFileId: item.xaiFileId,
    ...(item.mimeType ? { mimeType: item.mimeType } : {}),
  }));
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

export async function uploadFlowArtifact(input: {
  file: File;
  workspaceId?: string | null;
}): Promise<FlowArtifact> {
  const mimeType = normalizeHeliosFileMime(input.file.name, input.file.type);
  if (!isHeliosAllowedMimeType(mimeType)) {
    throw new Error("That file type is not supported.");
  }
  if (input.file.size > FLOW_ARTIFACT_MAX_BYTES) {
    throw new Error("File is too large (10 MB).");
  }
  const data = await fileToBase64(input.file);
  const workspaceId = String(input.workspaceId || "").trim();
  const res = await fetch(FLOW_ARTIFACTS_PATH, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      fileName: input.file.name,
      mimeType,
      data,
      ...(workspaceId ? { workspaceId } : {}),
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
  const parsed = parseFlowArtifact({
    name: (body as { name?: unknown }).name ?? input.file.name,
    mimeType: (body as { mimeType?: unknown }).mimeType ?? mimeType,
    xaiFileId:
      (body as { xaiFileId?: unknown; xai_file_id?: unknown }).xaiFileId ??
      (body as { xai_file_id?: unknown }).xai_file_id,
  });
  if (!parsed) throw new Error("Upload did not return a file id");
  return parsed;
}
