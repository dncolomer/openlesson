import { createHash } from "node:crypto";
import {
  addCustomAestheticUrls,
  readCustomAestheticUrls,
} from "@/lib/organization/custom-aesthetic-set";

export const ORG_AESTHETICS_BUCKET = "org-aesthetics";
export const MAX_CUSTOM_AESTHETIC_BYTES = 4 * 1024 * 1024;
export const MAX_CUSTOM_AESTHETIC_UPLOADS = 24;

const MIME_EXT: Record<string, "png" | "jpg" | "webp" | "gif"> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
};

const EXT_MIME: Record<"png" | "jpg" | "webp" | "gif", string> = {
  png: "image/png",
  jpg: "image/jpeg",
  webp: "image/webp",
  gif: "image/gif",
};

export type CustomAestheticUpload = {
  data: string;
  mimeType: string;
  fileName?: string;
};

export type ValidatedCustomAesthetic = {
  ext: "png" | "jpg" | "webp" | "gif";
  contentType: string;
  bytes: Buffer;
  storagePath: string;
  url: string;
};

export type CustomAestheticApplyResult =
  | {
      ok: true;
      urls: string[];
      added: ValidatedCustomAesthetic[];
    }
  | { ok: false; error: string; status: number; urls: string[] };

function stripDataUrl(data: string): string {
  const match = /^data:[^;]+;base64,(.+)$/i.exec(data.trim());
  return (match ? match[1] : data).replace(/\s/g, "");
}

export function sniffRasterExt(bytes: Buffer): "png" | "jpg" | "webp" | "gif" | null {
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  ) {
    return "png";
  }
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return "jpg";
  }
  if (bytes.length >= 6) {
    const head = bytes.toString("ascii", 0, 6);
    if (head === "GIF87a" || head === "GIF89a") return "gif";
  }
  if (
    bytes.length >= 12 &&
    bytes.toString("ascii", 0, 4) === "RIFF" &&
    bytes.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "webp";
  }
  return null;
}

function extFromFileName(fileName?: string): "png" | "jpg" | "webp" | "gif" | null {
  const ext = fileName?.split(".").pop()?.toLowerCase();
  if (ext === "png" || ext === "webp" || ext === "gif") return ext;
  if (ext === "jpg" || ext === "jpeg") return "jpg";
  return null;
}

export function customAestheticStoragePath(
  organizationId: string,
  bytes: Buffer,
  ext: string,
): string {
  const hash = createHash("sha256").update(bytes).digest("hex").slice(0, 32);
  return `${organizationId}/${hash}.${ext}`;
}

/** Public object URL. Relative when no Supabase origin is configured. */
export function customAestheticPublicUrl(storagePath: string, publicBaseUrl?: string): string {
  const path = `${ORG_AESTHETICS_BUCKET}/${storagePath}`;
  const base = String(publicBaseUrl || "").trim().replace(/\/$/, "");
  if (!base) return `/storage/v1/object/public/${path}`;
  return `${base}/storage/v1/object/public/${path}`;
}

export function parseCustomAestheticPayload(body: unknown): CustomAestheticUpload[] | null {
  if (!body || typeof body !== "object") return null;
  const images = (body as { images?: unknown }).images;
  if (!Array.isArray(images) || images.length === 0) return null;
  const parsed: CustomAestheticUpload[] = [];
  for (const item of images) {
    if (!item || typeof item !== "object") return null;
    const data = (item as { data?: unknown }).data;
    const mimeType = (item as { mimeType?: unknown }).mimeType;
    const fileName = (item as { fileName?: unknown }).fileName;
    if (typeof data !== "string" || typeof mimeType !== "string") return null;
    parsed.push({
      data,
      mimeType,
      fileName: typeof fileName === "string" ? fileName : undefined,
    });
  }
  return parsed;
}

/**
 * Accept one raster payload. A non-image (wrong type, or bytes that are not a
 * PNG/JPEG/WebP/GIF) is rejected and must not be added to the set.
 */
export function validateCustomAestheticUpload(
  input: CustomAestheticUpload,
  organizationId: string,
  publicBaseUrl?: string,
): { ok: true; image: ValidatedCustomAesthetic } | { ok: false; error: string; status: number } {
  const mimeType = String(input.mimeType || "").toLowerCase().trim();
  const declared = MIME_EXT[mimeType] ?? null;
  const fromName = extFromFileName(input.fileName);
  if (!declared && mimeType && mimeType !== "application/octet-stream") {
    return { ok: false, error: "Image must be PNG, JPEG, WebP, or GIF", status: 400 };
  }
  if (!declared && !fromName) {
    return { ok: false, error: "Image must be PNG, JPEG, WebP, or GIF", status: 400 };
  }

  const base64 = stripDataUrl(input.data || "");
  if (!base64) {
    return { ok: false, error: "Image data is required", status: 400 };
  }

  let bytes: Buffer;
  try {
    bytes = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Invalid image encoding", status: 400 };
  }
  if (bytes.length === 0) {
    return { ok: false, error: "Image file is empty", status: 400 };
  }
  if (bytes.length > MAX_CUSTOM_AESTHETIC_BYTES) {
    return { ok: false, error: "Image must be 4 MB or smaller", status: 400 };
  }

  const sniffed = sniffRasterExt(bytes);
  if (!sniffed) {
    return { ok: false, error: "File is not a valid image", status: 400 };
  }
  if (declared && sniffed !== declared) {
    return { ok: false, error: "File is not a valid image", status: 400 };
  }

  const ext = sniffed;
  const storagePath = customAestheticStoragePath(organizationId, bytes, ext);
  return {
    ok: true,
    image: {
      ext,
      contentType: EXT_MIME[ext],
      bytes,
      storagePath,
      url: customAestheticPublicUrl(storagePath, publicBaseUrl),
    },
  };
}

/**
 * Validate a batch against the current set. Any non-image rejects the whole
 * batch and leaves the set unchanged. Accepted rasters are distinct additions.
 */
export function applyCustomAestheticUploads(input: {
  current: readonly string[] | null | undefined;
  organizationId: string;
  uploads: readonly CustomAestheticUpload[];
  publicBaseUrl?: string;
}): CustomAestheticApplyResult {
  const urls = readCustomAestheticUrls(input.current);
  const organizationId = String(input.organizationId || "").trim();
  if (!organizationId) {
    return { ok: false, error: "Organization not found", status: 404, urls };
  }
  if (!Array.isArray(input.uploads) || input.uploads.length === 0) {
    return { ok: false, error: "At least one image is required", status: 400, urls };
  }
  if (input.uploads.length > MAX_CUSTOM_AESTHETIC_UPLOADS) {
    return {
      ok: false,
      error: `Upload at most ${MAX_CUSTOM_AESTHETIC_UPLOADS} images at a time`,
      status: 400,
      urls,
    };
  }

  const added: ValidatedCustomAesthetic[] = [];
  for (const upload of input.uploads) {
    const validated = validateCustomAestheticUpload(upload, organizationId, input.publicBaseUrl);
    if (!validated.ok) {
      return { ok: false, error: validated.error, status: validated.status, urls };
    }
    added.push(validated.image);
  }

  return {
    ok: true,
    urls: addCustomAestheticUrls(
      urls,
      added.map((image) => image.url),
    ),
    added,
  };
}
