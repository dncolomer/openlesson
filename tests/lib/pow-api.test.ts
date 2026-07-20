import { describe, expect, it } from "vitest";
import { createdByApiKeyId } from "@/lib/pow-api/auth";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/pow-api/rate-limit";
import {
  canAssignApiKeyScopes,
  DEFAULT_API_KEY_SCOPES,
  GUEST_API_KEY_SCOPES,
  hasScope,
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
        scopes: ["tap:write"],
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
        scopes: ["tap:write"],
        auth_method: "oauth",
      })
    ).toBeNull();
  });
});

describe("hasScope", () => {
  it("allows wildcard", () => {
    expect(hasScope(["*"], "org:write")).toBe(true);
  });

  it("requires exact scope", () => {
    expect(hasScope(["workspaces:read"], "tap:write")).toBe(false);
    expect(hasScope(["tap:write"], "tap:write")).toBe(true);
    expect(hasScope(["tap:read"], "tap:read")).toBe(true);
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

  it("issues guest keys with workspaces:write for proof-of-work upload (create is UI-only)", () => {
    expect(GUEST_API_KEY_SCOPES).toContain("workspaces:write");
    expect(GUEST_API_KEY_SCOPES).not.toContain("org:write");
    expect(hasScope(GUEST_API_KEY_SCOPES, "workspaces:write")).toBe(true);
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