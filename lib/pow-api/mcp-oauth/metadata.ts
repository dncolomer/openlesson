import { NextResponse } from "next/server";
import {
  getAuthorizationServerMetadataUrl,
  getMcpResourceUri,
  getOAuthIssuer,
  getProtectedResourceMetadataUrl,
  MCP_OAUTH_RESOURCE_PATH,
  MCP_OAUTH_SCOPES,
} from "./config";

export function buildProtectedResourceMetadata(origin: string) {
  const issuer = getOAuthIssuer(origin);
  return {
    resource: getMcpResourceUri(origin),
    authorization_servers: [issuer],
    scopes_supported: MCP_OAUTH_SCOPES,
    bearer_methods_supported: ["header"],
    resource_documentation: `${issuer}/docs/proof-of-work-api`,
  };
}

export function buildAuthorizationServerMetadata(origin: string) {
  const issuer = getOAuthIssuer(origin);
  return {
    issuer,
    authorization_endpoint: `${issuer}/api/oauth/authorize`,
    token_endpoint: `${issuer}/api/oauth/token`,
    registration_endpoint: `${issuer}/api/oauth/register`,
    jwks_uri: `${issuer}/api/oauth/jwks`,
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
    scopes_supported: MCP_OAUTH_SCOPES,
    client_id_metadata_document_supported: true,
    resource_parameter_supported: true,
    service_documentation: `${issuer}/docs/proof-of-work-api`,
    ui_locales_supported: ["en"],
  };
}

export function buildMcpUnauthorizedResponse(origin: string) {
  const resourceMetadataUrl = getProtectedResourceMetadataUrl(origin);
  const scope = MCP_OAUTH_SCOPES.join(" ");
  const challenge = `Bearer realm="uncertain-systems", resource_metadata="${resourceMetadataUrl}", scope="${scope}"`;

  return NextResponse.json(
    {
      error: {
        code: "unauthorized",
        message: "OAuth authorization is required for MCP access.",
        details: {
          resource_metadata: resourceMetadataUrl,
          authorization_server_metadata: getAuthorizationServerMetadataUrl(origin),
          resource: getMcpResourceUri(origin),
        },
      },
    },
    {
      status: 401,
      headers: {
        "WWW-Authenticate": challenge,
      },
    }
  );
}

export function mcpResourceDiscoveryPaths(): string[] {
  return [
    "/.well-known/oauth-protected-resource",
    `/.well-known/oauth-protected-resource${MCP_OAUTH_RESOURCE_PATH}`,
  ];
}