import crypto from "crypto";

/** CSPRNG invite token (URL-safe). */
export function createInviteToken(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashInviteToken(token: string): string {
  return crypto.createHash("sha256").update(token, "utf8").digest("hex");
}

/**
 * Non-secret placeholder stored in the legacy `token` unique column for hashed invites.
 * Real secret is only returned once at creation time and stored as token_hash.
 */
export function inviteTokenStoragePlaceholder(tokenHash: string): string {
  return `h_${tokenHash.slice(0, 48)}`;
}

export function isHashedInvitePlaceholder(token: string | null | undefined): boolean {
  return typeof token === "string" && token.startsWith("h_");
}
