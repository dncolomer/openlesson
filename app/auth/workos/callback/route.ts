import { NextRequest, NextResponse } from "next/server";
import { getAppOrigin } from "@/lib/app-url";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { decodeWorkOsOAuthState } from "@/lib/workos/authorize";
import { bindWorkOsIdentityToSupabaseSession } from "@/lib/workos/bind-session";
import { exchangeWorkOsAuthorizationCode } from "@/lib/workos/client";
import { workOsClientConfigFromEnv, WORKOS_CALLBACK_PATH } from "@/lib/workos/config";
import { workOsIdentitySatisfiesAuthUser, sessionUserFromWorkOsIdentity } from "@/lib/workos/identity";

export const runtime = "nodejs";

const STATE_COOKIE = "us_workos_oauth_state";

export async function GET(req: NextRequest) {
  const origin = getAppOrigin(req);
  const login = new URL("/login", origin);
  const config = workOsClientConfigFromEnv(process.env, origin);
  if ("error" in config) {
    login.searchParams.set("error", "sso_unconfigured");
    return NextResponse.redirect(login);
  }

  const code = String(req.nextUrl.searchParams.get("code") || "").trim();
  const state = String(req.nextUrl.searchParams.get("state") || "").trim();
  const cookieState = req.cookies.get(STATE_COOKIE)?.value || "";
  const parsed = decodeWorkOsOAuthState(state || cookieState);
  if (!code || !state || !cookieState || state !== cookieState || !parsed.nonce) {
    login.searchParams.set("error", "sso_state");
    return NextResponse.redirect(login);
  }

  try {
    const identity = await exchangeWorkOsAuthorizationCode({ config, code });
    const user = sessionUserFromWorkOsIdentity(identity);
    if (!workOsIdentitySatisfiesAuthUser(user)) {
      throw new Error("WorkOS profile is missing email");
    }
    const supabase = await createClient();
    const admin = createAdminClient();
    await bindWorkOsIdentityToSupabaseSession({ admin, supabase, identity });
    const response = NextResponse.redirect(new URL(parsed.next || "/dashboard", origin));
    response.cookies.set(STATE_COOKIE, "", { path: WORKOS_CALLBACK_PATH, maxAge: 0 });
    return response;
  } catch (error) {
    console.error("[workos/callback]", error instanceof Error ? error.message : error);
    login.searchParams.set("error", "sso_failed");
    return NextResponse.redirect(login);
  }
}
