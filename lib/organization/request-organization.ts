/**
 * Explicit organization targeting for multi-org users.
 * Public agent REST + MCP require organization_id on every call.
 */

import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import type { ErrorCode } from "@/lib/api/error-codes";
import { userCanAccessOrganization } from "@/lib/organization/membership-store";
import type { AuthContext } from "@/lib/pow-api/types";
import { createAdminClient } from "@/lib/supabase/admin";

export const ORGANIZATION_ID_HEADER = "x-organization-id";
export const ORGANIZATION_ID_REQUIRED_MESSAGE = "organization_id is required";

export class OrganizationRequestError extends Error {
  readonly status: 400 | 401 | 403;
  readonly code: ErrorCode;

  constructor(status: 400 | 401 | 403, code: ErrorCode, message: string) {
    super(message);
    this.name = "OrganizationRequestError";
    this.status = status;
    this.code = code;
  }
}

export function isOrganizationRequestError(
  error: unknown,
): error is OrganizationRequestError {
  return error instanceof OrganizationRequestError;
}

export function organizationRequestResponse(error: OrganizationRequestError) {
  return jsonError(error.status, error.message, error.code);
}

export function parseOrganizationIdValue(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const id = value.trim();
  return id || null;
}

export function parseOrganizationIdFromRecord(
  record: Record<string, unknown> | null | undefined,
): string | null {
  if (!record) return null;
  return (
    parseOrganizationIdValue(record.organization_id) ||
    parseOrganizationIdValue(record.organizationId)
  );
}

export function parseOrganizationIdFromSearchParams(
  params: URLSearchParams,
): string | null {
  return (
    parseOrganizationIdValue(params.get("organization_id")) ||
    parseOrganizationIdValue(params.get("organizationId"))
  );
}

export function parseOrganizationIdFromHeaders(headers: Headers): string | null {
  return (
    parseOrganizationIdValue(headers.get(ORGANIZATION_ID_HEADER)) ||
    parseOrganizationIdValue(headers.get("X-Organization-Id"))
  );
}

export function parseOrganizationIdFromRequest(
  req: NextRequest,
  body?: Record<string, unknown> | null,
): string | null {
  return (
    parseOrganizationIdFromRecord(body) ||
    parseOrganizationIdFromSearchParams(req.nextUrl.searchParams) ||
    parseOrganizationIdFromHeaders(req.headers)
  );
}

export async function assertAccessibleOrganizationId(input: {
  userId?: string | null;
  email?: string | null;
  guestUserId?: string | null;
  guestOrganizationId?: string | null;
  keyOrganizationId?: string | null;
  organizationId: string;
}): Promise<string> {
  const organizationId = parseOrganizationIdValue(input.organizationId);
  if (!organizationId) {
    throw new OrganizationRequestError(
      400,
      "organization_id_required",
      ORGANIZATION_ID_REQUIRED_MESSAGE,
    );
  }

  const keyOrganizationId = parseOrganizationIdValue(input.keyOrganizationId);
  if (keyOrganizationId && keyOrganizationId !== organizationId) {
    throw new OrganizationRequestError(
      403,
      "forbidden",
      "This API key is bound to a different organization",
    );
  }

  const guestUserId = String(input.guestUserId || "").trim();
  const userId = String(input.userId || "").trim();
  if (guestUserId && !userId) {
    const guestOrg = parseOrganizationIdValue(input.guestOrganizationId);
    if (guestOrg && guestOrg === organizationId) return organizationId;
    throw new OrganizationRequestError(
      403,
      "forbidden",
      "You do not belong to that organization",
    );
  }

  if (!userId) {
    throw new OrganizationRequestError(401, "auth_required", "Not authenticated");
  }

  const allowed = await userCanAccessOrganization(createAdminClient(), {
    userId,
    organizationId,
    email: input.email,
  });
  if (!allowed) {
    throw new OrganizationRequestError(
      403,
      "forbidden",
      "You do not belong to that organization",
    );
  }
  return organizationId;
}

export async function requireAgentOrganizationId(
  req: NextRequest,
  auth: AuthContext,
  body?: Record<string, unknown> | null,
): Promise<string> {
  const organizationId = parseOrganizationIdFromRequest(req, body);
  if (!organizationId) {
    throw new OrganizationRequestError(
      400,
      "organization_id_required",
      ORGANIZATION_ID_REQUIRED_MESSAGE,
    );
  }
  return assertAccessibleOrganizationId({
    userId: auth.user_id,
    guestUserId: auth.guest_user_id,
    guestOrganizationId: auth.organization_id,
    keyOrganizationId: auth.key_organization_id,
    organizationId,
  });
}

export async function requireToolOrganizationId(input: {
  auth: AuthContext;
  args: Record<string, unknown>;
}): Promise<string> {
  const organizationId = parseOrganizationIdFromRecord(input.args);
  if (!organizationId) {
    throw new OrganizationRequestError(
      400,
      "organization_id_required",
      ORGANIZATION_ID_REQUIRED_MESSAGE,
    );
  }
  return assertAccessibleOrganizationId({
    userId: input.auth.user_id,
    guestUserId: input.auth.guest_user_id,
    guestOrganizationId: input.auth.organization_id,
    keyOrganizationId: input.auth.key_organization_id,
    organizationId,
  });
}

export async function requireAgentRequestOrganization(
  req: NextRequest,
  auth: AuthContext,
  body?: Record<string, unknown> | null,
): Promise<
  { ok: true; organizationId: string } | { ok: false; response: ReturnType<typeof jsonError> }
> {
  try {
    const organizationId = await requireAgentOrganizationId(req, auth, body);
    return { ok: true, organizationId };
  } catch (error) {
    if (isOrganizationRequestError(error)) {
      return { ok: false, response: organizationRequestResponse(error) };
    }
    throw error;
  }
}
