import crypto from "crypto";

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(value);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

let warnedOAuthFallback = false;

export function getOAuthSigningSecret(): string {
  if (process.env.MCP_OAUTH_SECRET) {
    return process.env.MCP_OAUTH_SECRET;
  }
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    if (process.env.NODE_ENV === "production" && !warnedOAuthFallback) {
      warnedOAuthFallback = true;
      console.warn(
        "[mcp-oauth] MCP_OAUTH_SECRET is not set; falling back to SUPABASE_SERVICE_ROLE_KEY. Set a dedicated MCP_OAUTH_SECRET in production.",
      );
    }
    return process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error(
      "MCP_OAUTH_SECRET must be set in production (refusing to use dev fallback secret).",
    );
  }
  return "uncertain-systems-mcp-oauth-dev-secret";
}

export function signPayload(payload: string): string {
  return crypto.createHmac("sha256", getOAuthSigningSecret()).update(payload).digest("base64url");
}

export function encodeSignedObject<T extends Record<string, unknown>>(value: T): string {
  const payload = Buffer.from(JSON.stringify(value), "utf8").toString("base64url");
  const signature = signPayload(payload);
  return `${payload}.${signature}`;
}

export function decodeSignedObject<T extends Record<string, unknown>>(token: string): T | null {
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const expected = signPayload(payload);
  const provided = Buffer.from(signature, "utf8");
  const expectedBuf = Buffer.from(expected, "utf8");
  if (provided.length !== expectedBuf.length || !crypto.timingSafeEqual(provided, expectedBuf)) {
    return null;
  }
  try {
    return JSON.parse(Buffer.from(payload, "base64url").toString("utf8")) as T;
  } catch {
    return null;
  }
}

export async function hashOAuthToken(token: string): Promise<string> {
  return sha256Hex(token);
}

export function generateOAuthToken(prefix: string): string {
  return `${prefix}${crypto.randomBytes(32).toString("base64url")}`;
}

export function generateClientId(): string {
  return `mcp_${crypto.randomBytes(16).toString("hex")}`;
}

export function generateAuthorizationCode(): string {
  return crypto.randomBytes(32).toString("base64url");
}

export function verifyPkceChallenge(
  codeVerifier: string,
  codeChallenge: string,
  method: string
): boolean {
  if (method !== "S256") return false;
  const digest = crypto.createHash("sha256").update(codeVerifier).digest("base64url");
  const actual = Buffer.from(digest, "utf8");
  const expected = Buffer.from(codeChallenge, "utf8");
  if (actual.length !== expected.length) return false;
  return crypto.timingSafeEqual(actual, expected);
}