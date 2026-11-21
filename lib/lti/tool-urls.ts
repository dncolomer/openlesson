import { DEFAULT_APP_ORIGIN } from "@/lib/app-url";

export const LTI_LOGIN_PATH = "/lti/login";
export const LTI_LAUNCH_PATH = "/lti/launch";
export const LTI_JWKS_PATH = "/lti/jwks";
export const LTI_DEEP_LINK_PATH = "/lti/deep-link";
export const LTI_DASHBOARD_PATH = "/api/dashboard/lti";

export type LtiToolUrls = {
  origin: string;
  domain: string;
  loginUrl: string;
  launchUrl: string;
  jwksUrl: string;
  deepLinkUrl: string;
  redirectUrls: string[];
  targetLinkUri: string;
};

function originOf(origin: string): string {
  const value = String(origin || "").trim().replace(/\/$/, "");
  return value || DEFAULT_APP_ORIGIN;
}

export function ltiToolUrls(origin: string): LtiToolUrls {
  const base = originOf(origin);
  const loginUrl = `${base}${LTI_LOGIN_PATH}`;
  const launchUrl = `${base}${LTI_LAUNCH_PATH}`;
  const jwksUrl = `${base}${LTI_JWKS_PATH}`;
  const deepLinkUrl = `${base}${LTI_DEEP_LINK_PATH}`;
  return {
    origin: base,
    domain: base,
    loginUrl,
    launchUrl,
    jwksUrl,
    deepLinkUrl,
    redirectUrls: [launchUrl, deepLinkUrl],
    targetLinkUri: launchUrl,
  };
}
