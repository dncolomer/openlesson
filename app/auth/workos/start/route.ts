import { NextRequest, NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { encodeWorkOsOAuthState, workOsAuthorizationUrl } from "@/lib/workos/authorize";
import { workOsClientConfigFromEnv, WORKOS_CALLBACK_PATH } from "@/lib/workos/config";

export const runtime = "nodejs";

const STATE_COOKIE = "us_workos_oauth_state";

function safeNext(raw: string | null): string {
  const next = String(raw || "").trim();
  if (!next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const config = workOsClientConfigFromEnv(process.env, origin);
  if ("error" in config) {
    const login = new URL("/login", origin);
    login.searchParams.set("error", "sso_unconfigured");
    return NextResponse.redirect(login);
  }

  const next = safeNext(req.nextUrl.searchParams.get("next"));
  const nonce = crypto.randomUUID();
  const state = encodeWorkOsOAuthState({ nonce, next });
  const url = workOsAuthorizationUrl(config, {
    state,
    organizationId: req.nextUrl.searchParams.get("organization"),
    loginHint: req.nextUrl.searchParams.get("login_hint"),
  });
  const response = NextResponse.redirect(url);
  response.cookies.set(STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: origin.startsWith("https://"),
    path: WORKOS_CALLBACK_PATH,
    maxAge: 600,
  });
  return response;
}
