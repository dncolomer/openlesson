import { describe, expect, it } from "vitest";
import {
  buildAuthorizationServerMetadata,
  buildProtectedResourceMetadata,
} from "@/lib/agent-v2/mcp-oauth/metadata";
import { buildMcpOAuthDiscovery } from "@/lib/agent-v2/mcp-proof-of-work-catalog";
import { verifyPkceChallenge } from "@/lib/agent-v2/mcp-oauth/crypto";
import { parseRequestedScopes } from "@/lib/agent-v2/mcp-oauth/config";
import crypto from "crypto";

describe("mcp oauth metadata", () => {
  it("exposes protected resource metadata for the MCP endpoint", () => {
    const metadata = buildProtectedResourceMetadata("https://uncertain.systems");
    expect(metadata.resource).toBe("https://uncertain.systems/api/mcp");
    expect(metadata.authorization_servers).toEqual(["https://uncertain.systems"]);
    expect(metadata.scopes_supported).toContain("workspaces:read");
  });

  it("exposes authorization server metadata with OAuth endpoints", () => {
    const metadata = buildAuthorizationServerMetadata("https://uncertain.systems");
    expect(metadata.issuer).toBe("https://uncertain.systems");
    expect(metadata.authorization_endpoint).toBe("https://uncertain.systems/api/oauth/authorize");
    expect(metadata.token_endpoint).toBe("https://uncertain.systems/api/oauth/token");
    expect(metadata.registration_endpoint).toBe("https://uncertain.systems/api/oauth/register");
    expect(metadata.code_challenge_methods_supported).toEqual(["S256"]);
    expect(metadata.client_id_metadata_document_supported).toBe(true);
  });

  it("builds dashboard discovery URLs", () => {
    const discovery = buildMcpOAuthDiscovery("https://uncertain.systems");
    expect(discovery.resource).toBe("https://uncertain.systems/api/mcp");
    expect(discovery.protected_resource_metadata).toBe(
      "https://uncertain.systems/.well-known/oauth-protected-resource/api/mcp"
    );
  });
});

describe("mcp oauth helpers", () => {
  it("verifies PKCE S256 challenges", () => {
    const verifier = "test-verifier-123";
    const challenge = crypto.createHash("sha256").update(verifier).digest("base64url");
    expect(verifyPkceChallenge(verifier, challenge, "S256")).toBe(true);
    expect(verifyPkceChallenge("wrong", challenge, "S256")).toBe(false);
  });

  it("defaults requested scopes when none are provided", () => {
    expect(parseRequestedScopes(undefined)).toEqual([
      "workspaces:read",
      "workspaces:write",
      "tap:read",
      "tap:write",
    ]);
  });
});