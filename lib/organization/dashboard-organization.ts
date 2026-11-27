/**
 * Cookie dashboard APIs: honor request organization_id, else the sidebar active org.
 */

import type { NextRequest } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import {
  isOrganizationRequestError,
  organizationRequestResponse,
  parseOrganizationIdFromRequest,
  assertAccessibleOrganizationId,
} from "@/lib/organization/request-organization";
import { loadActiveOrganizationId } from "@/lib/organization/membership-store";
import { createAdminClient } from "@/lib/supabase/admin";

export async function resolveDashboardOrganizationId(input: {
  req: NextRequest;
  userId: string;
  email?: string | null;
  body?: Record<string, unknown> | null;
}): Promise<
  | { ok: true; organizationId: string | null }
  | { ok: false; response: ReturnType<typeof jsonError> }
> {
  const admin = createAdminClient();
  const requested = parseOrganizationIdFromRequest(input.req, input.body);
  const fallback = requested
    ? null
    : await loadActiveOrganizationId(admin, input.userId);
  const organizationId = requested || fallback;
  if (!organizationId) return { ok: true, organizationId: null };
  try {
    const allowed = await assertAccessibleOrganizationId({
      userId: input.userId,
      email: input.email,
      organizationId,
    });
    return { ok: true, organizationId: allowed };
  } catch (error) {
    if (isOrganizationRequestError(error)) {
      return { ok: false, response: organizationRequestResponse(error) };
    }
    throw error;
  }
}
