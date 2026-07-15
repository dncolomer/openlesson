import crypto from "crypto";

export function createPrivateToken() {
  return crypto.randomBytes(32).toString("base64url");
}

export function hashPrivateToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}