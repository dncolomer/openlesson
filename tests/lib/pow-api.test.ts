import { describe, expect, it } from "vitest";
import { createdByApiKeyId } from "@/lib/pow-api/auth";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/pow-api/rate-limit";
import {
  canAssignApiKeyScopes,
  DEFAULT_API_KEY_SCOPES,
  GUEST_API_KEY_SCOPES,
  hasScope,
  parseRequestedApiKeyScopes,
  requiresOrgAdminScope,
  validateAssignableScopes,
} from "@/lib/pow-api/scopes";

describe("createdByApiKeyId", () => {
  it("returns key id for API key auth", () => {
    expect(
      createdByApiKeyId({
        key_id: "key-uuid",
        user_id: "user-1",
        guest_user_id: null,
        organization_id: null,
        is_org_admin: false,
        scopes: ["protocols:write"],
        auth_method: "api_key",
      })
    ).toBe("key-uuid");
  });

  it("returns null for MCP OAuth tokens", () => {
    expect(
      createdByApiKeyId({
        key_id: "oauth-token-uuid",
        user_id: "user-1",
        guest_user_id: null,
        organization_id: null,
        is_org_admin: false,
        scopes: ["protocols:write"],
        auth_method: "oauth",
      })
    ).toBeNull();
  });
});

describe("hasScope", () => {
  it("allows wildcard", () => {
    expect(hasScope(["*"], "org:write")).toBe(true);
    expect(hasScope(["*"], "protocols:write")).toBe(true);
    expect(hasScope(["*"], "knowledge-regions:read")).toBe(true);
  });

  it("enforces exact scope matching and rejects missing or legacy scopes", () => {
    expect(hasScope(["protocols:read"], "protocols:read")).toBe(true);
    expect(hasScope(["protocols:read"], "protocols:write")).toBe(false);
    expect(hasScope(["protocols:read"], "knowledge-regions:read")).toBe(false);
    expect(hasScope(["knowledge-regions:write"], "knowledge-regions:write")).toBe(true);
    expect(hasScope([], "protocols:read")).toBe(false);
  });

  it("validates requested scopes and rejects legacy workspaces:* scopes", () => {
    expect(parseRequestedApiKeyScopes(undefined)).toEqual({ ok: true, scopes: ["*"] });
    expect(parseRequestedApiKeyScopes(["protocols:read", "knowledge-regions:write"])).toEqual({
      ok: true,
      scopes: ["protocols:read", "knowledge-regions:write"],
    });
    expect(parseRequestedApiKeyScopes(["workspaces:read"]).ok).toBe(false);
    expect(parseRequestedApiKeyScopes(["workspaces:write"]).ok).toBe(false);
    expect(parseRequestedApiKeyScopes(["tap:read"]).ok).toBe(false);
  });
});

describe("scope assignment", () => {
  it("blocks org scopes for non-admins", () => {
    expect(requiresOrgAdminScope(["org:write"])).toBe(true);
    const result = validateAssignableScopes(["org:write"], { is_org_admin: false });
    expect(result.ok).toBe(false);
  });

  it("allows org scopes for org admins", () => {
    const result = validateAssignableScopes(["org:write"], { is_org_admin: true });
    expect(result.ok).toBe(true);
  });

  it("defaults to non-org scopes", () => {
    expect(DEFAULT_API_KEY_SCOPES).not.toContain("org:write");
    expect(canAssignApiKeyScopes({ is_org_admin: false })).toBe(false);
    expect(canAssignApiKeyScopes({ is_org_admin: true })).toBe(true);
  });

  it("issues guest keys with wildcard scope for protocol and region operations", () => {
    expect(GUEST_API_KEY_SCOPES).toContain("*");
    expect(GUEST_API_KEY_SCOPES).not.toContain("org:write");
    expect(hasScope(GUEST_API_KEY_SCOPES, "protocols:write")).toBe(true);
    expect(hasScope(GUEST_API_KEY_SCOPES, "knowledge-regions:read")).toBe(true);
  });
});

describe("rate limiting", () => {
  it("enforces per-minute limits", () => {
    resetRateLimitsForTests();
    const keyId = "test-key";
    expect(checkRateLimit(keyId, 2).allowed).toBe(true);
    expect(checkRateLimit(keyId, 2).allowed).toBe(true);
    expect(checkRateLimit(keyId, 2).allowed).toBe(false);
  });
});