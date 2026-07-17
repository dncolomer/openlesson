/**
 * Client-side helpers for reading a logo file and POSTing it as base64.
 */

export type LogoPayload = {
  data: string;
  mimeType: string;
  fileName: string;
};

const ALLOWED = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
  "image/gif",
  "image/svg+xml",
]);

const MAX_BYTES = 2 * 1024 * 1024;

export function validateLogoFile(file: File): string | null {
  if (!ALLOWED.has(file.type) && !/\.(png|jpe?g|webp|gif|svg)$/i.test(file.name)) {
    return "Logo must be PNG, JPEG, WebP, GIF, or SVG";
  }
  if (file.size > MAX_BYTES) {
    return "Logo must be 2 MB or smaller";
  }
  return null;
}

export function fileToLogoPayload(file: File): Promise<LogoPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        data: base64,
        mimeType: file.type || "image/png",
        fileName: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read logo file"));
    reader.readAsDataURL(file);
  });
}

export function fileToPreviewUrl(file: File): string {
  return URL.createObjectURL(file);
}
