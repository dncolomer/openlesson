import type { LtiAgsEndpoint, LtiDeepLinkingSettings, LtiNrpsEndpoint } from "@/lib/lti/claims";
import type { LtiResourceTarget } from "@/lib/lti/resource-link";
import type { ProductFlowKind } from "@/lib/product-flow";

export const LTI_LAUNCH_COOKIE = "us_lti_launch";

export type LtiLaunchSession = {
  launchId: string;
  platformId: string;
  organizationId: string;
  issuer: string;
  clientId: string;
  sub: string;
  identity: string;
  displayName: string;
  email: string;
  instructor: boolean;
  contextId: string;
  deploymentId: string;
  resourceLinkId: string;
  flowToken?: string;
  flowKind?: ProductFlowKind;
  regionId?: string;
  action?: "create_region";
  ags?: LtiAgsEndpoint | null;
  nrps?: LtiNrpsEndpoint | null;
  deepLinking?: LtiDeepLinkingSettings | null;
};

export function launchSessionFromTarget(
  session: LtiLaunchSession,
  target: LtiResourceTarget | null,
): LtiLaunchSession {
  if (!target) return session;
  if (target.kind === "flow") {
    return { ...session, flowToken: target.flowToken, flowKind: target.flowKind, action: undefined };
  }
  if (target.kind === "region") {
    return { ...session, regionId: target.regionId, action: undefined };
  }
  return { ...session, action: "create_region" };
}

export function protocolPublicPathForSession(session: LtiLaunchSession): string | null {
  const token = String(session.flowToken || "").trim();
  if (!token) return null;
  return `/v/${encodeURIComponent(token)}`;
}

export function regionPathForSession(session: LtiLaunchSession): string | null {
  if (session.action === "create_region") return "/lti/regions/new";
  const id = String(session.regionId || "").trim();
  if (!id) return null;
  return `/lti/regions/${encodeURIComponent(id)}`;
}
