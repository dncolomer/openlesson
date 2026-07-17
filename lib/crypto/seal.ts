import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;

function deriveKey(secret: string): Buffer {
  return createHash("sha256").update(secret, "utf8").digest();
}

/**
 * Prefer dedicated encryption secrets. Service-role fallback is last-resort so
 * existing sealed rows remain openable when only SUPABASE_SERVICE_ROLE_KEY was used.
 * Never prefer service role when a dedicated secret is configured.
 */
export function resolveSealSecrets(): string[] {
  const dedicated = [
    process.env.XAI_ORG_KEY_ENCRYPTION_SECRET,
    process.env.ORG_SECRETS_ENCRYPTION_KEY,
  ].filter((s): s is string => typeof s === "string" && s.length > 0);

  // Deduplicate while preserving order
  const seen = new Set<string>();
  const ordered: string[] = [];
  for (const s of dedicated) {
    if (!seen.has(s)) {
      seen.add(s);
      ordered.push(s);
    }
  }

  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (serviceRole && !seen.has(serviceRole)) {
    ordered.push(serviceRole);
  }

  return ordered;
}

function getSealSecret(): string {
  const secrets = resolveSealSecrets();
  if (secrets.length === 0) {
    throw new Error(
      "Missing encryption secret: set XAI_ORG_KEY_ENCRYPTION_SECRET (or ORG_SECRETS_ENCRYPTION_KEY)"
    );
  }
  return secrets[0];
}

/**
 * Seal a UTF-8 string. Output format: base64(iv || tag || ciphertext).
 * Uses the first dedicated secret when present (not service role if dedicated is set).
 */
export function sealString(plaintext: string, secret?: string): string {
  const key = deriveKey(secret ?? getSealSecret());
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGO, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

/**
 * Open a sealed string produced by sealString.
 * Tries dedicated secrets first, then service-role fallback for legacy data.
 */
export function openSealedString(sealed: string, secret?: string): string {
  if (secret) {
    return openWithSecret(sealed, secret);
  }

  const secrets = resolveSealSecrets();
  if (secrets.length === 0) {
    throw new Error(
      "Missing encryption secret: set XAI_ORG_KEY_ENCRYPTION_SECRET (or ORG_SECRETS_ENCRYPTION_KEY)"
    );
  }

  let lastError: unknown;
  for (const s of secrets) {
    try {
      return openWithSecret(sealed, s);
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error("Failed to open sealed payload");
}

function openWithSecret(sealed: string, secret: string): string {
  const key = deriveKey(secret);
  const buf = Buffer.from(sealed, "base64");
  if (buf.length < IV_LENGTH + TAG_LENGTH + 1) {
    throw new Error("Invalid sealed payload");
  }
  const iv = buf.subarray(0, IV_LENGTH);
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
  const ciphertext = buf.subarray(IV_LENGTH + TAG_LENGTH);
  const decipher = createDecipheriv(ALGO, key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}
