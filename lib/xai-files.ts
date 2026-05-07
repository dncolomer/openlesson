// ============================================
// xAI Files API client
// Manages file uploads/storage on xAI's servers instead of Supabase Storage.
// xAI extracts text natively from PDFs (and many other formats) which we use
// as LLM context for plan generation.
//
// API ref: https://docs.x.ai/developers/rest-api-reference/files
// ============================================

const XAI_BASE_URL = "https://api.x.ai";

function getApiKey(): string {
  const key = process.env.XAI_API_KEY;
  if (!key) throw new Error("XAI_API_KEY not configured");
  return key;
}

function authHeader(): Record<string, string> {
  return { Authorization: `Bearer ${getApiKey()}` };
}

function ensureTimestampedName(name: string): string {
  if (/(^|[_-])\d{13}(?=$|[_\-.])/.test(name)) {
    return name;
  }

  const slashIndex = name.lastIndexOf("/");
  const directory = slashIndex >= 0 ? name.slice(0, slashIndex + 1) : "";
  const baseName = slashIndex >= 0 ? name.slice(slashIndex + 1) : name;
  const dotIndex = baseName.lastIndexOf(".");
  const ts = Date.now();

  if (dotIndex <= 0) {
    return `${directory}${baseName}_${ts}`;
  }

  return `${directory}${baseName.slice(0, dotIndex)}_${ts}${baseName.slice(dotIndex)}`;
}

export interface XAIFileMetadata {
  file_id: string;
  name: string;
  size_bytes: string | number;
  content_type: string;
  created_at?: string;
  expires_at?: string | null;
  hash?: string;
  upload_status?: string;
  processing_status?: string;
}

/**
 * Upload a file to xAI Files API.
 *
 * xAI's POST /v1/files endpoint requires multipart/form-data, not JSON.
 * (The OpenAI-compat shape works: a `file` field with the binary data.)
 *
 * @param name - Original file name
 * @param mimeType - MIME type (e.g. "application/pdf")
 * @param base64Data - File contents as base64-encoded string
 */
export async function uploadFileToXAI(
  name: string,
  mimeType: string,
  base64Data: string
): Promise<XAIFileMetadata> {
  const timestampedName = ensureTimestampedName(name);
  const buffer = Buffer.from(base64Data, "base64");
  const blob = new Blob([buffer as BlobPart], { type: mimeType });

  const formData = new FormData();
  formData.append("file", blob, timestampedName);

  const res = await fetch(`${XAI_BASE_URL}/v1/files`, {
    method: "POST",
    // Do NOT set Content-Type manually — fetch sets the multipart boundary
    headers: authHeader(),
    body: formData,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`xAI file upload failed (${res.status}): ${text}`);
  }

  const data = await res.json();

  // xAI returns OpenAI-compatible shape from multipart upload: { id, filename, bytes, ... }
  // Normalize to our XAIFileMetadata shape (file_id, name, size_bytes, ...)
  return {
    file_id: data.file_id || data.id,
    name: data.name || data.filename || timestampedName,
    size_bytes: data.size_bytes || data.bytes || buffer.length,
    content_type: data.content_type || mimeType,
    created_at: data.created_at,
    expires_at: data.expires_at,
    hash: data.hash,
    upload_status: data.upload_status,
    processing_status: data.processing_status,
  };
}

/**
 * Stream raw file bytes from xAI for download/proxy.
 * Returns the Response so the caller can pipe it through.
 *
 * The endpoint returns the original file bytes by default (OpenAI-compat).
 */
export async function getFileContentResponse(fileId: string): Promise<Response> {
  return fetch(
    `${XAI_BASE_URL}/v1/files/${encodeURIComponent(fileId)}/content`,
    { headers: authHeader() }
  );
}

/**
 * Fetch file content as UTF-8 text. Used for transcript chunks uploaded to
 * xAI as plain-text files.
 *
 * Returns null if the fetch fails.
 */
export async function getFileTextContent(fileId: string): Promise<string | null> {
  try {
    const res = await fetch(
      `${XAI_BASE_URL}/v1/files/${encodeURIComponent(fileId)}/content`,
      { headers: authHeader() }
    );
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`[xai-files] getFileTextContent failed for ${fileId} status=${res.status} body=${body.slice(0, 200)}`);
      return null;
    }
    const text = await res.text();
    return text;
  } catch (err) {
    console.error(`[xai-files] getFileTextContent error for ${fileId}:`, err);
    return null;
  }
}

/**
 * Get metadata for a file.
 */
export async function getFileMetadata(fileId: string): Promise<XAIFileMetadata | null> {
  const res = await fetch(`${XAI_BASE_URL}/v1/files/${encodeURIComponent(fileId)}`, {
    headers: authHeader(),
  });
  if (!res.ok) return null;
  return (await res.json()) as XAIFileMetadata;
}

/**
 * Delete a file from xAI.
 */
export async function deleteFileFromXAI(fileId: string): Promise<boolean> {
  const res = await fetch(`${XAI_BASE_URL}/v1/files/${encodeURIComponent(fileId)}`, {
    method: "DELETE",
    headers: authHeader(),
  });
  return res.ok;
}
