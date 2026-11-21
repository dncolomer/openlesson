import { workOsAuthenticateRequest } from "@/lib/workos/authenticate";
import type { WorkOsClientConfig } from "@/lib/workos/config";
import {
  workOsAppIdentityFromCallbackInput,
  type WorkOsAppIdentity,
} from "@/lib/workos/identity";
import {
  parseWorkOsOrganizationId,
  parseWorkOsPortalLink,
  presentWorkOsSsoOnboarding,
  workOsAdminPortalRequest,
  workOsCreateOrganizationRequest,
  type WorkOsSsoOnboarding,
} from "@/lib/workos/onboard";

async function workOsJson(
  request: { url: string; headers: Record<string, string>; body: Record<string, unknown> },
): Promise<unknown> {
  const response = await fetch(request.url, {
    method: "POST",
    headers: request.headers,
    body: JSON.stringify(request.body),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      (payload && typeof payload === "object" && "message" in payload
        ? String((payload as { message?: unknown }).message || "")
        : "") || `WorkOS ${response.status}`;
    throw new Error(message);
  }
  return payload;
}

export async function exchangeWorkOsAuthorizationCode(input: {
  config: WorkOsClientConfig;
  code: string;
}): Promise<WorkOsAppIdentity> {
  const request = workOsAuthenticateRequest(input.config, input.code);
  const payload = await workOsJson(request);
  const row = (payload && typeof payload === "object" ? payload : {}) as {
    user?: unknown;
    organization_id?: unknown;
    organizationId?: unknown;
  };
  const identity = workOsAppIdentityFromCallbackInput({
    code: input.code,
    user: row.user,
    organizationId: String(row.organization_id || row.organizationId || "").trim() || null,
  });
  if ("error" in identity) throw new Error(identity.error);
  return identity;
}

export async function createWorkOsSsoOnboarding(input: {
  config: WorkOsClientConfig;
  name: string;
  domain?: string | null;
  existingOrganizationId?: string | null;
  returnUrl?: string | null;
}): Promise<WorkOsSsoOnboarding> {
  let organizationId = String(input.existingOrganizationId || "").trim();
  if (!organizationId) {
    const created = await workOsJson(
      workOsCreateOrganizationRequest(input.config, {
        name: input.name,
        domain: input.domain,
      }),
    );
    organizationId = parseWorkOsOrganizationId(created);
  }
  const portal = await workOsJson(
    workOsAdminPortalRequest(input.config, {
      organizationId,
      intent: "sso",
      returnUrl: input.returnUrl,
    }),
  );
  const link = parseWorkOsPortalLink(portal);
  if ("error" in link) throw new Error(link.error);
  const presented = presentWorkOsSsoOnboarding({
    organizationId,
    portalLink: link.link,
  });
  if ("error" in presented) throw new Error(presented.error);
  return presented;
}
