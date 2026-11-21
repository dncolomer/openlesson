/** IMS LTI 1.3 / Advantage claim URIs. */

export const LTI_MESSAGE_TYPE_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/message_type";
export const LTI_VERSION_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/version";
export const LTI_DEPLOYMENT_ID_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/deployment_id";
export const LTI_TARGET_LINK_URI_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/target_link_uri";
export const LTI_RESOURCE_LINK_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/resource_link";
export const LTI_ROLES_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/roles";
export const LTI_CONTEXT_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/context";
export const LTI_CUSTOM_CLAIM = "https://purl.imsglobal.org/spec/lti/claim/custom";
export const LTI_LAUNCH_PRESENTATION_CLAIM =
  "https://purl.imsglobal.org/spec/lti/claim/launch_presentation";
export const LTI_AGS_CLAIM = "https://purl.imsglobal.org/spec/lti-ags/claim/endpoint";
export const LTI_NRPS_CLAIM =
  "https://purl.imsglobal.org/spec/lti-nrps/claim/namesroleservice";
export const LTI_DL_SETTINGS_CLAIM =
  "https://purl.imsglobal.org/spec/lti-dl/claim/deep_linking_settings";

export const LTI_VERSION = "1.3.0";

export const LTI_MESSAGE_RESOURCE_LINK = "LtiResourceLinkRequest";
export const LTI_MESSAGE_DEEP_LINKING = "LtiDeepLinkingRequest";

export const LTI_ROLE_INSTRUCTOR =
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Instructor";
export const LTI_ROLE_LEARNER =
  "http://purl.imsglobal.org/vocab/lis/v2/membership#Learner";
export const LTI_ROLE_TEACHING_ASSISTANT =
  "http://purl.imsglobal.org/vocab/lis/v2/membership#TeachingAssistant";
export const LTI_ROLE_CONTENT_DEVELOPER =
  "http://purl.imsglobal.org/vocab/lis/v2/membership#ContentDeveloper";

export const LTI_AGS_SCOPE_LINEITEM =
  "https://purl.imsglobal.org/spec/lti-ags/scope/lineitem";
export const LTI_AGS_SCOPE_SCORE =
  "https://purl.imsglobal.org/spec/lti-ags/scope/score";
export const LTI_AGS_SCOPE_RESULT =
  "https://purl.imsglobal.org/spec/lti-ags/scope/result.readonly";

export const LTI_NRPS_SCOPE =
  "https://purl.imsglobal.org/spec/lti-nrps/scope/contextmembership.readonly";

export type LtiMessageType =
  | typeof LTI_MESSAGE_RESOURCE_LINK
  | typeof LTI_MESSAGE_DEEP_LINKING;

export type LtiAgsEndpoint = {
  scope: string[];
  lineitems?: string;
  lineitem?: string;
};

export type LtiNrpsEndpoint = {
  context_memberships_url: string;
  service_versions?: string[];
};

export type LtiDeepLinkingSettings = {
  deep_link_return_url: string;
  accept_types?: string[];
  accept_presentation_document_targets?: string[];
  accept_multiple?: boolean | string;
  auto_create?: boolean | string;
  data?: string;
};

export function textClaim(value: unknown): string {
  return String(value ?? "").trim();
}

export function stringArrayClaim(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => String(item || "").trim()).filter(Boolean);
}

export function parseMessageType(value: unknown): LtiMessageType | null {
  const raw = textClaim(value);
  if (raw === LTI_MESSAGE_RESOURCE_LINK || raw === LTI_MESSAGE_DEEP_LINKING) return raw;
  return null;
}

export function ltiRolesIncludeInstructor(roles: readonly string[]): boolean {
  return roles.some(
    (role) =>
      role === LTI_ROLE_INSTRUCTOR ||
      role === LTI_ROLE_TEACHING_ASSISTANT ||
      role === LTI_ROLE_CONTENT_DEVELOPER ||
      role.endsWith("#Instructor") ||
      role.endsWith("/Instructor"),
  );
}

export function parseAgsEndpoint(value: unknown): LtiAgsEndpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const scope = stringArrayClaim(row.scope);
  const lineitems = textClaim(row.lineitems) || undefined;
  const lineitem = textClaim(row.lineitem) || undefined;
  if (!scope.length && !lineitems && !lineitem) return null;
  return { scope, lineitems, lineitem };
}

export function parseNrpsEndpoint(value: unknown): LtiNrpsEndpoint | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const context_memberships_url = textClaim(row.context_memberships_url);
  if (!context_memberships_url) return null;
  return {
    context_memberships_url,
    service_versions: stringArrayClaim(row.service_versions),
  };
}

export function parseDeepLinkingSettings(value: unknown): LtiDeepLinkingSettings | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;
  const deep_link_return_url = textClaim(row.deep_link_return_url);
  if (!deep_link_return_url) return null;
  return {
    deep_link_return_url,
    accept_types: stringArrayClaim(row.accept_types),
    accept_presentation_document_targets: stringArrayClaim(
      row.accept_presentation_document_targets,
    ),
    accept_multiple: row.accept_multiple as boolean | string | undefined,
    auto_create: row.auto_create as boolean | string | undefined,
    data: textClaim(row.data) || undefined,
  };
}

export function parseCustomClaim(value: unknown): Record<string, string> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const out: Record<string, string> = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    const name = String(key || "").trim();
    const text = textClaim(raw);
    if (name && text) out[name] = text;
  }
  return out;
}

export function parseContextId(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return textClaim(value);
  return textClaim((value as { id?: unknown }).id);
}

export function parseResourceLinkId(value: unknown): string {
  if (!value || typeof value !== "object" || Array.isArray(value)) return textClaim(value);
  return textClaim((value as { id?: unknown }).id);
}
