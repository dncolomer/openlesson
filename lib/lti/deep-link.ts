import { SignJWT } from "jose";
import type { LtiSigningKey } from "@/lib/lti/keys";
import { LTI_VERSION, type LtiDeepLinkingSettings } from "@/lib/lti/claims";
import type { ProductFlowKind } from "@/lib/product-flow";
import { LTI_LAUNCH_PATH } from "@/lib/lti/tool-urls";

export type LtiDeepLinkCatalogFlow = {
  type: "flow";
  id: string;
  name: string;
  kind: ProductFlowKind;
  publicToken: string;
};

export type LtiDeepLinkCatalogRegion = {
  type: "region";
  id: string;
  name: string;
  kind: ProductFlowKind;
};

export type LtiDeepLinkCatalogItem =
  | LtiDeepLinkCatalogFlow
  | LtiDeepLinkCatalogRegion
  | { type: "create_region"; kind?: ProductFlowKind };

export function deepLinkContentItem(
  origin: string,
  item: LtiDeepLinkCatalogItem,
): Record<string, unknown> {
  const base = String(origin || "").replace(/\/$/, "");
  const launch = `${base}${LTI_LAUNCH_PATH}`;
  if (item.type === "flow") {
    return {
      type: "ltiResourceLink",
      title: item.name,
      url: launch,
      custom: { flow_token: item.publicToken },
    };
  }
  if (item.type === "region") {
    return {
      type: "ltiResourceLink",
      title: item.name,
      url: launch,
      custom: { region_id: item.id },
    };
  }
  return {
    type: "ltiResourceLink",
    title: "Create knowledge region",
    url: launch,
    custom: { action: "create_region" },
  };
}

export async function signDeepLinkingResponse(input: {
  issuer: string;
  clientId: string;
  deploymentId: string;
  settings: LtiDeepLinkingSettings;
  contentItems: Record<string, unknown>[];
  privateKey: LtiSigningKey;
  kid?: string;
}): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const jwt = new SignJWT({
    "https://purl.imsglobal.org/spec/lti/claim/message_type": "LtiDeepLinkingResponse",
    "https://purl.imsglobal.org/spec/lti/claim/version": LTI_VERSION,
    "https://purl.imsglobal.org/spec/lti/claim/deployment_id": input.deploymentId,
    "https://purl.imsglobal.org/spec/lti-dl/claim/content_items": input.contentItems,
    ...(input.settings.data
      ? { "https://purl.imsglobal.org/spec/lti-dl/claim/data": input.settings.data }
      : {}),
  })
    .setProtectedHeader({ alg: "RS256", kid: input.kid, typ: "JWT" })
    .setIssuer(input.issuer)
    .setAudience(input.clientId)
    .setIssuedAt(now)
    .setExpirationTime(now + 600);
  return jwt.sign(input.privateKey);
}

export function deepLinkReturnForm(returnUrl: string, jwt: string): string {
  const action = escapeHtml(returnUrl);
  const token = escapeHtml(jwt);
  return `<!doctype html><html><body><form id="dl" method="post" action="${action}"><input type="hidden" name="JWT" value="${token}"/></form><script>document.getElementById("dl").submit()</script></body></html>`;
}

function escapeHtml(value: string): string {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}
