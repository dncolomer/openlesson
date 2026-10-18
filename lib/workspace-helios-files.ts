/**
 * Helios Chat file attachments: composer chips + prompt/API context.
 * Local uploads are turn context (not workspace_files). Workspace Context
 * files can be selected by name and resolved server-side to xAI file ids.
 */

export const HELIOS_MAP_MAX_ATTACHED_FILES = 5;
export const HELIOS_MAP_MAX_FILE_BYTES = 10 * 1024 * 1024;
export const HELIOS_MAP_FILES_FALLBACK_PROMPT =
  "Use the attached files as context for this Learning Map.";
export const HELIOS_MAP_FILE_ACCEPT =
  ".pdf,.txt,.md,.jpg,.jpeg,.png,.webp";

export const HELIOS_MAP_ALLOWED_MIME_TYPES = [
  "application/pdf",
  "text/plain",
  "text/markdown",
  "text/x-markdown",
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
] as const;

const ALLOWED = new Set<string>(HELIOS_MAP_ALLOWED_MIME_TYPES);

export type HeliosAttachedFile = {
  name: string;
  mimeType: string;
  data: string;
  size: number;
};

const MIME_BY_EXT: Record<string, string> = {
  pdf: "application/pdf",
  txt: "text/plain",
  md: "text/markdown",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export function heliosFileIsImage(mimeType: string): boolean {
  return mimeType.trim().toLowerCase().startsWith("image/");
}

export function isHeliosAllowedMimeType(mimeType: string): boolean {
  return ALLOWED.has(mimeType.trim().toLowerCase());
}

export function normalizeHeliosFileMime(
  name: string,
  mimeType: string,
): string {
  const mime = String(mimeType || "").trim().toLowerCase();
  if (ALLOWED.has(mime)) return mime === "image/jpg" ? "image/jpeg" : mime;
  const ext = String(name || "")
    .trim()
    .toLowerCase()
    .split(".")
    .pop();
  return (ext && MIME_BY_EXT[ext]) || mime;
}

export function parseHeliosAttachedFiles(raw: unknown): HeliosAttachedFile[] {
  if (!Array.isArray(raw)) return [];
  const out: HeliosAttachedFile[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const name = String(rec.name || rec.fileName || rec.file_name || "").trim();
    const data = String(rec.data || rec.base64 || "").replace(/\s+/g, "");
    const mimeType = normalizeHeliosFileMime(
      name,
      String(rec.mimeType || rec.mime_type || ""),
    );
    if (!name || !data || !isHeliosAllowedMimeType(mimeType)) continue;
    let size = Number(rec.size);
    if (!Number.isFinite(size) || size <= 0) {
      size = Math.ceil((data.length * 3) / 4);
    }
    if (size > HELIOS_MAP_MAX_FILE_BYTES) continue;
    out.push({ name, mimeType, data, size });
    if (out.length >= HELIOS_MAP_MAX_ATTACHED_FILES) break;
  }
  return out;
}

export function parseHeliosWorkspaceFileNames(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of raw) {
    const name = String(item || "").trim();
    if (!name || seen.has(name)) continue;
    seen.add(name);
    out.push(name);
    if (out.length >= HELIOS_MAP_MAX_ATTACHED_FILES) break;
  }
  return out;
}

export function capHeliosAttachedFiles<T>(
  local: readonly T[],
  workspace: readonly string[],
): { local: T[]; workspace: string[] } {
  const workspaceCapped = workspace.slice(0, HELIOS_MAP_MAX_ATTACHED_FILES);
  const remaining = HELIOS_MAP_MAX_ATTACHED_FILES - workspaceCapped.length;
  return {
    local: local.slice(0, Math.max(0, remaining)),
    workspace: workspaceCapped,
  };
}

function decodeBase64Text(data: string): string {
  try {
    const binary = globalThis.atob(data);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
    return new TextDecoder("utf-8").decode(bytes);
  } catch {
    return "";
  }
}

export function heliosTextExcerptFromAttachedFile(
  file: HeliosAttachedFile,
  maxChars = 2_400,
): string {
  if (heliosFileIsImage(file.mimeType) || file.mimeType === "application/pdf") {
    return "";
  }
  const text = decodeBase64Text(file.data).replace(/\s+/g, " ").trim();
  if (!text) return "";
  return text.length > maxChars ? `${text.slice(0, maxChars)}…` : text;
}

export function formatHeliosFilesForPrompt(input: {
  attached: readonly HeliosAttachedFile[];
  workspaceNames?: readonly string[];
}): string {
  const attached = input.attached || [];
  const workspaceNames = input.workspaceNames || [];
  if (attached.length === 0 && workspaceNames.length === 0) {
    return [
      "ATTACHED FILES (author context above the Helios composer)",
      "No files attached.",
    ].join("\n");
  }
  const lines: string[] = [
    "ATTACHED FILES (author context above the Helios composer)",
  ];
  for (const file of attached) {
    lines.push(`- ${file.name} (${file.mimeType})`);
    const excerpt = heliosTextExcerptFromAttachedFile(file);
    if (excerpt) lines.push(`  excerpt: ${excerpt}`);
  }
  for (const name of workspaceNames) {
    lines.push(`- ${name} (workspace Context file)`);
  }
  lines.push(
    "Read these files. Ground the map in this material when the author is building from it.",
  );
  return lines.join("\n");
}
