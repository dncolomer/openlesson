import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { LTI_MESSAGE_DEEP_LINKING } from "@/lib/lti/claims";
import { encodeLaunchCookie, launchCookieOptions } from "@/lib/lti/cookie";
import { readLtiFormBody } from "@/lib/lti/form-body";
import { verifyLtiIdToken } from "@/lib/lti/launch";
import { fetchPlatformJwks } from "@/lib/lti/platform-jwks";
import {
  protocolPublicPathForSession,
  launchSessionFromTarget,
  regionPathForSession,
  type LtiLaunchSession,
} from "@/lib/lti/session";
import { consumeOidcState, findLtiPlatform, saveLtiLaunch } from "@/lib/lti/store";
import { LTI_DEEP_LINK_PATH } from "@/lib/lti/tool-urls";
import { getVerificationFlowByToken } from "@/lib/verification-flow-repository";
import { ownerInOrganization } from "@/lib/lti/resource-link";
import { organizationMemberIds } from "@/lib/lti/store";

export const runtime = "nodejs";

async function resolveFlow(
  token: string,
): Promise<{ ownerUserId: string | null } | null> {
  const flow = await getVerificationFlowByToken(token);
  if (flow) return { ownerUserId: flow.ownerUserId || null };
  return null;
}

export async function POST(req: NextRequest) {
  try {
    const body = await readLtiFormBody(req);
    const idToken = String(body.id_token || "").trim();
    const state = String(body.state || "").trim();
    if (!idToken) return jsonError(400, "id_token is required");
    const oidc = await consumeOidcState(state);
    if (!oidc) return jsonError(400, "login state is invalid");
    const platform = await findLtiPlatform({ issuer: oidc.iss, clientId: oidc.clientId });
    if (!platform?.id) return jsonError(400, "Unknown LTI platform");
    const jwks = await fetchPlatformJwks(platform.keysetUrl);
    const verified = await verifyLtiIdToken({
      idToken,
      jwks,
      issuer: platform.issuer,
      clientId: platform.clientId,
      nonce: oidc.nonce,
      deploymentIds: platform.deploymentIds,
      state: oidc,
    });
    if (!verified.ok) return jsonError(400, verified.error);
    const launch = verified.launch;
    let session: LtiLaunchSession = {
      launchId: crypto.randomUUID(),
      platformId: platform.id,
      organizationId: platform.organizationId,
      issuer: launch.iss,
      clientId: launch.aud,
      sub: launch.sub,
      identity: launch.identity,
      displayName: launch.displayName,
      email: launch.email,
      instructor: launch.instructor,
      contextId: launch.contextId,
      deploymentId: launch.deploymentId,
      resourceLinkId: launch.resourceLinkId,
      ags: launch.ags,
      nrps: launch.nrps,
      deepLinking: launch.deepLinking,
    };
    session = launchSessionFromTarget(session, launch.target);

    if (session.flowToken) {
      const resolved = await resolveFlow(session.flowToken);
      if (!resolved) return jsonError(404, "Flow not found");
      const members = await organizationMemberIds(platform.organizationId);
      if (!ownerInOrganization(resolved.ownerUserId, members)) {
        return jsonError(403, "Flow is not in this organization");
      }
      session = { ...session, flowKind: "verification" };
    }

    await saveLtiLaunch(session);
    const token = await encodeLaunchCookie(session);
    const cookie = launchCookieOptions();

    if (launch.messageType === LTI_MESSAGE_DEEP_LINKING) {
      const response = NextResponse.redirect(new URL(LTI_DEEP_LINK_PATH, req.url), 302);
      response.cookies.set(cookie.name, token, cookie);
      return response;
    }

    const regionPath = regionPathForSession(session);
    if (regionPath) {
      const response = NextResponse.redirect(new URL(regionPath, req.url), 302);
      response.cookies.set(cookie.name, token, cookie);
      return response;
    }

    const protocolPath = protocolPublicPathForSession(session);
    if (protocolPath) {
      const response = NextResponse.redirect(new URL(`${protocolPath}?lti=1`, req.url), 302);
      response.cookies.set(cookie.name, token, cookie);
      return response;
    }

    if (launch.instructor) {
      const response = NextResponse.redirect(new URL(LTI_DEEP_LINK_PATH, req.url), 302);
      response.cookies.set(cookie.name, token, cookie);
      return response;
    }

    return jsonError(400, "No protocol or knowledge region on this launch");
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI launch failed";
    return jsonError(500, message);
  }
}
