import { describe, expect, it } from "vitest";
import { checkRateLimit, resetRateLimitsForTests } from "@/lib/agent-v2/rate-limit";
import {
  canAssignApiKeyScopes,
  DEFAULT_API_KEY_SCOPES,
  GUEST_API_KEY_SCOPES,
  hasScope,
  requiresOrgAdminScope,
  validateAssignableScopes,
} from "@/lib/agent-v2/scopes";

describe("hasScope", () => {
  it("allows wildcard", () => {
    expect(hasScope(["*"], "org:write")).toBe(true);
  });

  it("requires exact scope", () => {
    expect(hasScope(["workspaces:read"], "ghl:write")).toBe(false);
    expect(hasScope(["ghl:write"], "ghl:write")).toBe(true);
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

  it("allows guest keys to create workspaces", () => {
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