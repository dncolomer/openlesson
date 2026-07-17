import type { SupabaseClient } from "@supabase/supabase-js";

const ORG_LOGOS_BUCKET = "org-logos";
const MAX_LOGO_BYTES = 2 * 1024 * 1024; // 2 MB

const ALLOWED_MIME: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/jpg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export type LogoUploadInput = {
  data: string; // base64 (raw or data URL)
  mimeType: string;
  fileName?: string;
};

export type LogoUploadResult =
  | { ok: true; logoUrl: string; storagePath: string }
  | { ok: false; error: string; status: number };

function stripDataUrl(data: string): string {
  const match = /^data:[^;]+;base64,(.+)$/i.exec(data);
  return match ? match[1] : data;
}

function extensionForMime(mimeType: string, fileName?: string): string | null {
  const fromMime = ALLOWED_MIME[mimeType.toLowerCase()];
  if (fromMime) return fromMime;
  if (fileName) {
    const ext = fileName.split(".").pop()?.toLowerCase();
    if (ext && ["png", "jpg", "jpeg", "webp", "gif", "svg"].includes(ext)) {
      return ext === "jpeg" ? "jpg" : ext;
    }
  }
  return null;
}

/**
 * Upload an organization logo to the public org-logos bucket and return its public URL.
 * Path: `{orgId}/logo.{ext}` (overwrite-friendly).
 */
export async function uploadOrganizationLogo(
  adminClient: SupabaseClient,
  orgId: string,
  input: LogoUploadInput
): Promise<LogoUploadResult> {
  const mimeType = (input.mimeType || "").toLowerCase().trim();
  const ext = extensionForMime(mimeType, input.fileName);
  if (!ext) {
    return {
      ok: false,
      error: "Logo must be PNG, JPEG, WebP, GIF, or SVG",
      status: 400,
    };
  }

  const base64 = stripDataUrl(input.data || "").replace(/\s/g, "");
  if (!base64) {
    return { ok: false, error: "Logo data is required", status: 400 };
  }

  let buffer: Buffer;
  try {
    buffer = Buffer.from(base64, "base64");
  } catch {
    return { ok: false, error: "Invalid logo encoding", status: 400 };
  }

  if (buffer.length === 0) {
    return { ok: false, error: "Logo file is empty", status: 400 };
  }
  if (buffer.length > MAX_LOGO_BYTES) {
    return { ok: false, error: "Logo must be 2 MB or smaller", status: 400 };
  }

  const storagePath = `${orgId}/logo.${ext}`;
  const contentType = mimeType.startsWith("image/")
    ? mimeType
    : `image/${ext === "jpg" ? "jpeg" : ext}`;

  const { error: uploadError } = await adminClient.storage
    .from(ORG_LOGOS_BUCKET)
    .upload(storagePath, buffer, {
      contentType,
      upsert: true,
      cacheControl: "3600",
    });

  if (uploadError) {
    console.error("[org-logo] upload failed:", uploadError);
    return { ok: false, error: "Failed to upload logo", status: 500 };
  }

  const { data: publicData } = adminClient.storage
    .from(ORG_LOGOS_BUCKET)
    .getPublicUrl(storagePath);

  // Bust caches after overwrite
  const logoUrl = `${publicData.publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await adminClient
    .from("organizations")
    .update({
      logo_url: logoUrl,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);

  if (updateError) {
    console.error("[org-logo] failed to save logo_url:", updateError);
    return { ok: false, error: "Logo uploaded but failed to save on organization", status: 500 };
  }

  return { ok: true, logoUrl, storagePath };
}

export function parseLogoPayload(body: unknown): LogoUploadInput | null {
  if (!body || typeof body !== "object") return null;
  const logo = (body as { logo?: unknown }).logo;
  if (!logo || typeof logo !== "object") return null;
  const data = (logo as { data?: unknown }).data;
  const mimeType = (logo as { mimeType?: unknown }).mimeType;
  const fileName = (logo as { fileName?: unknown }).fileName;
  if (typeof data !== "string" || typeof mimeType !== "string") return null;
  return {
    data,
    mimeType,
    fileName: typeof fileName === "string" ? fileName : undefined,
  };
}
