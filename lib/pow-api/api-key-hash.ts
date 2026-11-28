import crypto from "crypto";

export async function hashApiKey(key: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function verifyApiKey(
  providedKey: string,
  keyHash: string,
): Promise<boolean> {
  const providedHash = await hashApiKey(providedKey);
  const a = Buffer.from(providedHash, "utf8");
  const b = Buffer.from(keyHash, "utf8");
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function getApiKeyPrefix(key: string): string {
  return key.substring(0, 8);
}
