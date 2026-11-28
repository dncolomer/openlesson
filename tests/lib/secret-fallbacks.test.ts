import { afterEach, describe, expect, it } from "vitest";
import {
  decodeSignedObject,
  encodeSignedObject,
  getOAuthSigningSecret,
  verifyPkceChallenge,
} from "@/lib/pow-api/mcp-oauth/crypto";
import { decodeLaunchCookie, encodeLaunchCookie } from "@/lib/lti/cookie";

describe("production secret fallbacks and signing hygiene", () => {
  const env = process.env as Record<string, string | undefined>;
  const saved = {
    NODE_ENV: env.NODE_ENV,
    MCP_OAUTH_SECRET: env.MCP_OAUTH_SECRET,
    LTI_COOKIE_SECRET: env.LTI_COOKIE_SECRET,
    ORG_SECRETS_ENCRYPTION_KEY: env.ORG_SECRETS_ENCRYPTION_KEY,
    SUPABASE_SERVICE_ROLE_KEY: env.SUPABASE_SERVICE_ROLE_KEY,
  };

  afterEach(() => {
    for (const [k, v] of Object.entries(saved)) {
      if (v === undefined) delete env[k];
      else env[k] = v;
    }
  });

  it("refuses hardcoded dev fallback for MCP OAuth secret in production", () => {
    env.NODE_ENV = "production";
    delete env.MCP_OAUTH_SECRET;
    delete env.SUPABASE_SERVICE_ROLE_KEY;
    expect(() => getOAuthSigningSecret()).toThrow(/MCP_OAUTH_SECRET must be set in production/);
  });

  it("prefers dedicated MCP_OAUTH_SECRET and detects tampered payloads", () => {
    env.NODE_ENV = "production";
    env.MCP_OAUTH_SECRET = "dedicated-oauth-secret-xyz";
    expect(getOAuthSigningSecret()).toBe("dedicated-oauth-secret-xyz");

    const token = encodeSignedObject({ sub: "user-1", scope: "protocols:read" });
    expect(decodeSignedObject(token)).toEqual({ sub: "user-1", scope: "protocols:read" });
    expect(decodeSignedObject(`${token}tampered`)).toBeNull();
  });

  const sampleSession = {
    launchId: "launch-1",
    platformId: "plat-1",
    organizationId: "org-1",
    issuer: "https://canvas.example.edu",
    clientId: "client-1",
    sub: "sub-1",
    identity: "learner-1",
    displayName: "Test Learner",
    email: "learner@example.edu",
    instructor: false,
    contextId: "ctx-1",
    deploymentId: "dep-1",
    resourceLinkId: "rl-1",
  };

  it("refuses hardcoded dev fallback for LTI cookie secret in production", async () => {
    env.NODE_ENV = "production";
    delete env.LTI_COOKIE_SECRET;
    delete env.ORG_SECRETS_ENCRYPTION_KEY;
    delete env.SUPABASE_SERVICE_ROLE_KEY;

    await expect(encodeLaunchCookie(sampleSession)).rejects.toThrow(
      /LTI_COOKIE_SECRET must be set in production/,
    );
  });

  it("round-trips LTI launch cookie with dedicated secret and rejects tampered tokens", async () => {
    env.NODE_ENV = "production";
    env.LTI_COOKIE_SECRET = "dedicated-lti-secret-abc";

    const cookie = await encodeLaunchCookie(sampleSession);
    expect(await decodeLaunchCookie(cookie)).toEqual(sampleSession);
    expect(await decodeLaunchCookie(`${cookie}x`)).toBeNull();
  });

  it("rejects non-S256 and mismatched-length PKCE challenges", () => {
    expect(verifyPkceChallenge("verifier", "short", "S256")).toBe(false);
    expect(verifyPkceChallenge("verifier", "verifier", "plain")).toBe(false);
  });
});
