import type { AuthContext } from "./types";

export const WORKSPACE_EVIDENCE_TYPES = ["tool", "screen", "video", "eeg"] as const;
export type WorkspaceEvidenceType = (typeof WORKSPACE_EVIDENCE_TYPES)[number];

const EVIDENCE_TYPE_ALIASES: Record<string, WorkspaceEvidenceType> = {
  tool: "tool",
  screen: "screen",
  screenshot: "screen",
  screenshots: "screen",
  video: "video",
  eeg: "eeg",
};

const MIME_BY_TYPE: Record<WorkspaceEvidenceType, Set<string>> = {
  tool: new Set(["application/json", "text/plain", "text/markdown", "text/x-markdown"]),
  screen: new Set(["image/png", "image/jpeg", "image/jpg", "image/webp"]),
  video: new Set(["video/mp4", "video/webm", "video/quicktime"]),
  eeg: new Set(["application/json", "text/plain"]),
};

export const MAX_WORKSPACE_EVIDENCE_BYTES = 10 * 1024 * 1024;

export function normalizeEvidenceType(value: unknown): WorkspaceEvidenceType | null {
  if (typeof value !== "string") return null;
  return EVIDENCE_TYPE_ALIASES[value.trim().toLowerCase()] || null;
}

export function isAllowedEvidenceMime(type: WorkspaceEvidenceType, mimeType: string): boolean {
  return MIME_BY_TYPE[type].has(mimeType.trim().toLowerCase());
}

export function defaultEvidenceFileName(type: WorkspaceEvidenceType, provided?: string): string {
  if (provided?.trim()) return provided.trim();
  switch (type) {
    case "tool":
      return "tool-usage.json";
    case "screen":
      return "screenshot.png";
    case "video":
      return "capture.mp4";
    case "eeg":
      return "eeg-chunk.json";
  }
}

export interface WorkspaceEvidenceRow {
  id: string;
  plan_id: string;
  plan_node_id: string | null;
  session_id: string | null;
  evidence_type: WorkspaceEvidenceType;
  file_name: string;
  mime_type: string;
  file_size: number | null;
  xai_file_id: string;
  timestamp_ms: number;
  chunk_index: number;
  metadata: Record<string, unknown>;
  tool_name: string | null;
  tool_action: string | null;
  band_powers: Record<string, number> | null;
  device_name: string | null;
  sample_count: number | null;
  created_at: string;
}

export function evidenceQueryForAuth(auth: AuthContext) {
  return {
    guestUserId: auth.guest_user_id,
    restrictToGuest: !!auth.guest_user_id,
    restrictToUser: !auth.guest_user_id && !auth.is_org_admin,
    userId: auth.user_id,
  };
}