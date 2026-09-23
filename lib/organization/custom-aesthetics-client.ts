/**
 * Browser helpers for reading aesthetic stills before POST /api/organization/aesthetics.
 */

export type CustomAestheticPayload = {
  data: string;
  mimeType: string;
  fileName: string;
};

const ALLOWED = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const MAX_BYTES = 4 * 1024 * 1024;

export function validateAestheticFile(file: File): string | null {
  const typeOk = ALLOWED.has(file.type);
  const nameOk = /\.(png|jpe?g|webp|gif)$/i.test(file.name);
  if (!typeOk && !nameOk) {
    return "Image must be PNG, JPEG, WebP, or GIF";
  }
  if (file.type === "image/svg+xml" || /\.svg$/i.test(file.name)) {
    return "Image must be PNG, JPEG, WebP, or GIF";
  }
  if (file.size > MAX_BYTES) {
    return "Image must be 4 MB or smaller";
  }
  if (file.size === 0) {
    return "Image file is empty";
  }
  return null;
}

export function fileToAestheticPayload(file: File): Promise<CustomAestheticPayload> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      const base64 = result.includes(",") ? result.split(",")[1] : result;
      resolve({
        data: base64,
        mimeType: file.type || "application/octet-stream",
        fileName: file.name,
      });
    };
    reader.onerror = () => reject(new Error("Failed to read image"));
    reader.readAsDataURL(file);
  });
}
