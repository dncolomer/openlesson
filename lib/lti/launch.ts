import { createLocalJWKSet, jwtVerify, type JWTPayload, type JSONWebKeySet } from "jose";
import {
  LTI_AGS_CLAIM,
  LTI_CONTEXT_CLAIM,
  LTI_CUSTOM_CLAIM,
  LTI_DEPLOYMENT_ID_CLAIM,
  LTI_DL_SETTINGS_CLAIM,
  LTI_MESSAGE_TYPE_CLAIM,
  LTI_NRPS_CLAIM,
  LTI_RESOURCE_LINK_CLAIM,
  LTI_ROLES_CLAIM,
  LTI_TARGET_LINK_URI_CLAIM,
  LTI_VERSION,
  LTI_VERSION_CLAIM,
  ltiRolesIncludeInstructor,
  parseAgsEndpoint,
  parseContextId,
  parseCustomClaim,
  parseDeepLinkingSettings,
  parseMessageType,
  parseNrpsEndpoint,
  parseResourceLinkId,
  stringArrayClaim,
  textClaim,
  type LtiAgsEndpoint,
  type LtiDeepLinkingSettings,
  type LtiMessageType,
  type LtiNrpsEndpoint,
} from "@/lib/lti/claims";
import { ltiDisplayName, ltiParticipantIdentity } from "@/lib/lti/identity";
import { oidcStateIsFresh, type LtiOidcState } from "@/lib/lti/oidc";
import { ltiResourceTarget, type LtiResourceTarget } from "@/lib/lti/resource-link";

export type LtiVerifiedLaunch = {
  iss: string;
  aud: string;
  sub: string;
  nonce: string;
  deploymentId: string;
  messageType: LtiMessageType;
  targetLinkUri: string;
  identity: string;
  displayName: string;
  email: string;
  roles: string[];
  instructor: boolean;
  contextId: string;
  resourceLinkId: string;
  custom: Record<string, string>;
  target: LtiResourceTarget | null;
  ags: LtiAgsEndpoint | null;
  nrps: LtiNrpsEndpoint | null;
  deepLinking: LtiDeepLinkingSettings | null;
  payload: JWTPayload;
};

export type VerifyLtiIdTokenInput = {
  idToken: string;
  jwks: JSONWebKeySet;
  issuer: string;
  clientId: string;
  nonce: string;
  deploymentIds?: readonly string[];
  state?: LtiOidcState | null;
};

export async function verifyLtiIdToken(
  input: VerifyLtiIdTokenInput,
): Promise<{ ok: true; launch: LtiVerifiedLaunch } | { ok: false; error: string }> {
  const idToken = textClaim(input.idToken);
  if (!idToken) return { ok: false, error: "id_token is required" };
  if (input.state && !oidcStateIsFresh(input.state)) {
    return { ok: false, error: "login state expired" };
  }
  if (input.state && input.state.nonce !== input.nonce && input.nonce) {
    /* nonce from token is checked after verify */
  }
  let payload: JWTPayload;
  try {
    const jwks = createLocalJWKSet(input.jwks);
    const verified = await jwtVerify(idToken, jwks, {
      issuer: input.issuer,
      audience: input.clientId,
    });
    payload = verified.payload;
  } catch (error) {
    const message = error instanceof Error ? error.message : "invalid id_token";
    return { ok: false, error: message };
  }
  const nonce = textClaim(payload.nonce);
  if (!nonce || nonce !== input.nonce) return { ok: false, error: "nonce mismatch" };
  if (input.state && nonce !== input.state.nonce) return { ok: false, error: "nonce mismatch" };
  const messageType = parseMessageType(payload[LTI_MESSAGE_TYPE_CLAIM]);
  if (!messageType) return { ok: false, error: "unsupported message_type" };
  const version = textClaim(payload[LTI_VERSION_CLAIM]);
  if (version && version !== LTI_VERSION) return { ok: false, error: "unsupported LTI version" };
  const deploymentId = textClaim(payload[LTI_DEPLOYMENT_ID_CLAIM]);
  if (!deploymentId) return { ok: false, error: "deployment_id is required" };
  const allowed = (input.deploymentIds || []).map((id) => String(id).trim()).filter(Boolean);
  if (allowed.length && !allowed.includes(deploymentId)) {
    return { ok: false, error: "deployment_id is not registered" };
  }
  const iss = textClaim(payload.iss);
  const sub = textClaim(payload.sub);
  const aud = Array.isArray(payload.aud) ? textClaim(payload.aud[0]) : textClaim(payload.aud);
  const identity = ltiParticipantIdentity(iss, sub);
  if (!identity) return { ok: false, error: "sub is required" };
  const roles = stringArrayClaim(payload[LTI_ROLES_CLAIM]);
  const custom = parseCustomClaim(payload[LTI_CUSTOM_CLAIM]);
  const targetLinkUri = textClaim(payload[LTI_TARGET_LINK_URI_CLAIM]);
  return {
    ok: true,
    launch: {
      iss,
      aud,
      sub,
      nonce,
      deploymentId,
      messageType,
      targetLinkUri,
      identity,
      displayName: ltiDisplayName(payload as Record<string, unknown>),
      email: textClaim(payload.email),
      roles,
      instructor: ltiRolesIncludeInstructor(roles),
      contextId: parseContextId(payload[LTI_CONTEXT_CLAIM]),
      resourceLinkId: parseResourceLinkId(payload[LTI_RESOURCE_LINK_CLAIM]),
      custom,
      target: ltiResourceTarget({ custom, targetLinkUri }),
      ags: parseAgsEndpoint(payload[LTI_AGS_CLAIM]),
      nrps: parseNrpsEndpoint(payload[LTI_NRPS_CLAIM]),
      deepLinking: parseDeepLinkingSettings(payload[LTI_DL_SETTINGS_CLAIM]),
      payload,
    },
  };
}
