import {
  WORKOS_ORGANIZATIONS_PATH,
  WORKOS_PORTAL_LINK_PATH,
  type WorkOsClientConfig,
} from "@/lib/workos/config";

export type WorkOsSsoOnboarding = {
  organizationId: string;
  setupUrl: string;
  connectionId: string | null;
};

function text(value: unknown): string {
  return String(value ?? "").trim();
}

export function workOsCreateOrganizationRequest(
  config: WorkOsClientConfig,
  input: { name: string; domain?: string | null },
): { url: string; headers: Record<string, string>; body: Record<string, unknown> } {
  const name = text(input.name);
  if (!name) throw new Error("organization name is required");
  const domain = text(input.domain);
  const body: Record<string, unknown> = { name };
  if (domain) {
    body.domain_data = [{ domain, state: "pending" }];
  }
  return {
    url: `${config.apiBaseUrl}${WORKOS_ORGANIZATIONS_PATH}`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  };
}

export function workOsAdminPortalRequest(
  config: WorkOsClientConfig,
  input: {
    organizationId: string;
    intent?: "sso" | "dsync";
    returnUrl?: string | null;
  },
): { url: string; headers: Record<string, string>; body: Record<string, string> } {
  const organizationId = text(input.organizationId);
  if (!organizationId) throw new Error("WorkOS organization id is required");
  const body: Record<string, string> = {
    intent: input.intent || "sso",
    organization: organizationId,
  };
  const returnUrl = text(input.returnUrl);
  if (returnUrl) body.return_url = returnUrl;
  return {
    url: `${config.apiBaseUrl}${WORKOS_PORTAL_LINK_PATH}`,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
    },
    body,
  };
}

export function parseWorkOsPortalLink(payload: unknown): { link: string } | { error: string } {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return { error: "WorkOS portal payload is required" };
  }
  const row = payload as Record<string, unknown>;
  const link = text(row.link) || text(row.url);
  if (!link.startsWith("http")) return { error: "WorkOS Admin Portal link is missing" };
  return { link };
}

export function parseWorkOsOrganizationId(payload: unknown): string {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return "";
  const row = payload as Record<string, unknown>;
  return text(row.id) || text(row.organization_id);
}

export function presentWorkOsSsoOnboarding(input: {
  organizationId: string;
  portalLink?: string | null;
  setupUrl?: string | null;
  connectionId?: string | null;
}): WorkOsSsoOnboarding | { error: string } {
  const organizationId = text(input.organizationId);
  const setupUrl = text(input.setupUrl) || text(input.portalLink);
  if (!organizationId) return { error: "WorkOS organization id is required" };
  if (!setupUrl.startsWith("http")) {
    return { error: "SSO setup URL is required" };
  }
  return {
    organizationId,
    setupUrl,
    connectionId: text(input.connectionId) || null,
  };
}
