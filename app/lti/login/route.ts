import { NextRequest, NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { jsonError } from "@/lib/api-error-envelope";
import { loginInitiationFromRequest, readLtiFormBody } from "@/lib/lti/form-body";
import {
  buildPlatformAuthRedirect,
  defaultRedirectUri,
  newOidcState,
  parseLoginInitiation,
} from "@/lib/lti/oidc";
import { findLtiPlatform, saveOidcState } from "@/lib/lti/store";

export const runtime = "nodejs";

async function initiate(req: NextRequest, body: Record<string, string>) {
  const parsed = parseLoginInitiation(loginInitiationFromRequest(req, body));
  if ("error" in parsed) return jsonError(400, parsed.error);
  const platform = await findLtiPlatform({
    issuer: parsed.iss,
    clientId: parsed.clientId,
  });
  if (!platform?.id) return jsonError(400, "Unknown LTI platform");
  const state = newOidcState({ iss: parsed.iss, clientId: parsed.clientId });
  await saveOidcState(platform.id, state);
  const location = buildPlatformAuthRedirect({
    authLoginUrl: platform.authLoginUrl,
    clientId: platform.clientId,
    redirectUri: defaultRedirectUri(getAppOrigin(req)),
    state: state.state,
    nonce: state.nonce,
    loginHint: parsed.loginHint,
    ltiMessageHint: parsed.ltiMessageHint,
  });
  return NextResponse.redirect(location, 302);
}

export async function GET(req: NextRequest) {
  try {
    return await initiate(req, {});
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed";
    return jsonError(500, message);
  }
}

export async function POST(req: NextRequest) {
  try {
    return await initiate(req, await readLtiFormBody(req));
  } catch (error) {
    const message = error instanceof Error ? error.message : "LTI login failed";
    return jsonError(500, message);
  }
}
