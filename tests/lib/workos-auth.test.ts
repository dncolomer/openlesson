import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { workOsAuthenticateRequest } from "@/lib/workos/authenticate";
import {
  decodeWorkOsOAuthState,
  encodeWorkOsOAuthState,
  workOsAuthorizationUrl,
} from "@/lib/workos/authorize";
import {
  WORKOS_AUTHKIT_PROVIDER,
  WORKOS_CALLBACK_PATH,
  workOsClientConfigFromEnv,
  workOsRedirectUri,
} from "@/lib/workos/config";
import {
  sessionUserFromWorkOsIdentity,
  workOsAppIdentityFromCallbackInput,
  workOsIdentitySatisfiesAuthUser,
} from "@/lib/workos/identity";
import {
  presentWorkOsSsoOnboarding,
  workOsAdminPortalRequest,
} from "@/lib/workos/onboard";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const config = {
  apiKey: "sk_test_workos",
  clientId: "client_01WORKOS",
  redirectUri: "https://uncertain.systems/auth/workos/callback",
  apiBaseUrl: "https://api.workos.com",
};

describe("WorkOS authorization URL", () => {
  it("includes client id, redirect URI, and optional organization for SSO", () => {
    expect(workOsClientConfigFromEnv({})).toEqual({ error: "WORKOS_API_KEY is required" });
    const fromEnv = workOsClientConfigFromEnv({
      WORKOS_API_KEY: "sk_test_workos",
      WORKOS_CLIENT_ID: "client_01WORKOS",
      NEXT_PUBLIC_APP_URL: "https://uncertain.systems",
    });
    expect(fromEnv).toMatchObject({
      clientId: "client_01WORKOS",
      redirectUri: "https://uncertain.systems/auth/workos/callback",
    });
    expect(workOsRedirectUri("https://app.example", null)).toContain(WORKOS_CALLBACK_PATH);

    const url = workOsAuthorizationUrl(config, {
      state: "state-1",
      organizationId: "org_01ACME",
      loginHint: "ada@acme.com",
    });
    const parsed = new URL(url);
    expect(parsed.origin + parsed.pathname).toBe(
      "https://api.workos.com/user_management/authorize",
    );
    expect(parsed.searchParams.get("client_id")).toBe("client_01WORKOS");
    expect(parsed.searchParams.get("redirect_uri")).toBe(config.redirectUri);
    expect(parsed.searchParams.get("response_type")).toBe("code");
    expect(parsed.searchParams.get("provider")).toBe(WORKOS_AUTHKIT_PROVIDER);
    expect(parsed.searchParams.get("organization_id")).toBe("org_01ACME");
    expect(parsed.searchParams.get("login_hint")).toBe("ada@acme.com");
    expect(parsed.searchParams.get("state")).toBe("state-1");
  });
});

describe("WorkOS callback identity", () => {
  it("maps a representative authorization code and profile to an app session user", () => {
    const code = "01E3TJ5CEFMSH37QJGD2SBTQAT";
    const request = workOsAuthenticateRequest(config, code);
    expect(request.url).toBe("https://api.workos.com/user_management/authenticate");
    expect(request.body.grant_type).toBe("authorization_code");
    expect(request.body.code).toBe(code);
    expect(request.body.client_id).toBe(config.clientId);
    expect(request.body.client_secret).toBe(config.apiKey);
    expect(request.headers.Authorization).toBe(`Bearer ${config.apiKey}`);

    expect(workOsAppIdentityFromCallbackInput({ code: "", user: { id: "user_1" } })).toEqual({
      error: "authorization code is required",
    });

    const identity = workOsAppIdentityFromCallbackInput({
      code,
      user: {
        id: "user_01ADA",
        email: "ada@acme.com",
        first_name: "Ada",
        last_name: "Lovelace",
        organization_id: "org_01ACME",
      },
    });
    expect("error" in identity).toBe(false);
    if ("error" in identity) return;
    expect(identity.email).toBe("ada@acme.com");
    expect(identity.workosUserId).toBe("user_01ADA");
    expect(identity.userId).toBe("user_01ADA");
    expect(identity.organizationId).toBe("org_01ACME");
    const sessionUser = sessionUserFromWorkOsIdentity(identity);
    expect(sessionUser).toEqual({ id: "user_01ADA", email: "ada@acme.com" });
    expect(workOsIdentitySatisfiesAuthUser(sessionUser)).toBe(true);

    const encoded = encodeWorkOsOAuthState({ nonce: "n1", next: "/dashboard?tab=organization" });
    expect(decodeWorkOsOAuthState(encoded)).toEqual({
      nonce: "n1",
      next: "/dashboard?tab=organization",
    });
  });
});

describe("WorkOS enterprise SSO onboarding", () => {
  it("returns a setup URL a company admin can use to attach an IdP", () => {
    const request = workOsAdminPortalRequest(config, {
      organizationId: "org_01ACME",
      intent: "sso",
      returnUrl: "https://uncertain.systems/dashboard?tab=organization",
    });
    expect(request.url).toBe("https://api.workos.com/portal/generate_link");
    expect(request.body.intent).toBe("sso");
    expect(request.body.organization).toBe("org_01ACME");
    expect(request.body.return_url).toContain("organization");

    const onboarding = presentWorkOsSsoOnboarding({
      organizationId: "org_01ACME",
      portalLink: "https://id.workos.com/portal/launch?intent=sso&organization=org_01ACME",
      connectionId: "conn_01SAML",
    });
    expect("error" in onboarding).toBe(false);
    if ("error" in onboarding) return;
    expect(onboarding.setupUrl.startsWith("https://id.workos.com/portal/")).toBe(true);
    expect(onboarding.organizationId).toBe("org_01ACME");
    expect(onboarding.connectionId).toBe("conn_01SAML");
    expect(presentWorkOsSsoOnboarding({ organizationId: "org_01ACME" })).toEqual({
      error: "SSO setup URL is required",
    });
  });
});

describe("WorkOS login and org surfaces", () => {
  it("keeps password and magic-link while adding the SSO path", () => {
    const login = read("app/login/page.tsx");
    expect(login).toContain("signInWithPassword");
    expect(login).toContain("signInWithOtp");
    expect(login).toContain("data-auth-workos-sso");
    expect(login).toContain("/auth/workos/start");
    expect(login).toContain('t("auth.ssoSignIn")');
    expect(login).toContain("emailMagicLink");

    expect(existsSync(join(ROOT, "app/auth/workos/start/route.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "app/auth/workos/callback/route.ts"))).toBe(true);
    expect(read("app/auth/workos/start/route.ts")).toContain("workOsAuthorizationUrl");
    expect(read("app/auth/workos/callback/route.ts")).toContain("exchangeWorkOsAuthorizationCode");
    expect(read("app/auth/workos/callback/route.ts")).toContain("bindWorkOsIdentityToSupabaseSession");
    expect(read("app/api/organization/workos/sso/route.ts")).toContain("createWorkOsSsoOnboarding");

    const org = read("components/OrganizationDashboardTab.tsx");
    expect(org).toContain("data-org-workos-sso");
    expect(org).toContain("/api/organization/workos/sso");
    expect(org).toContain("setupUrl");

    expect(read("supabase/migrations/20261121190000_workos_sso.sql")).toContain("workos_user_id");
    expect(read("messages/en.json")).toContain('"ssoSignIn": "Sign in with company SSO"');
  });
});
