import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { sealString } from "@/lib/crypto/seal";
import {
  applyOrgBackendMutation,
  authorizeOrgBackendEdit,
  orgBackendUpdateRow,
  parseOrgBackendMutation,
  presentOrgBackends,
  type OrgBackendRecord,
} from "@/lib/organization/org-backends";

export const runtime = "nodejs";

type BackendProfile = {
  organization_id?: string | null;
  is_org_admin?: boolean | null;
};

const BACKEND_SELECT =
  "llm_backend, llm_provider, llm_base_url, llm_api_key_ciphertext, llm_api_key_last_four, llm_model, blob_backend, blob_provider, blob_base_url, blob_api_key_ciphertext, blob_api_key_last_four, openrouter_api_key_ciphertext, openrouter_api_key_last_four";

async function loadProfile(userId: string, supabase: { from: (table: string) => any }) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id, is_org_admin")
    .eq("id", userId)
    .single();
  if (error || !profile) return null;
  return profile as BackendProfile;
}

async function loadStored(orgId: string): Promise<OrgBackendRecord | null> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("organizations")
    .select(BACKEND_SELECT)
    .eq("id", orgId)
    .single();
  if (error || !data) return null;
  return data as OrgBackendRecord;
}

export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const profile = await loadProfile(auth.user.id, auth.supabase);
    if (!profile?.organization_id) {
      return NextResponse.json({ backends: presentOrgBackends(null) });
    }
    const stored = await loadStored(profile.organization_id);
    return NextResponse.json({ backends: presentOrgBackends(stored) });
  } catch (error) {
    console.error("Organization backends read error:", error);
    return jsonError(500, "Internal server error");
  }
}

export async function PUT(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => null);
    const parsed = parseOrgBackendMutation(body);
    if (!parsed.ok) return jsonError(parsed.status, parsed.error);

    const profile = await loadProfile(auth.user.id, auth.supabase);
    const guard = authorizeOrgBackendEdit(profile);
    if (!guard.ok) return jsonError(guard.status, guard.error);

    const stored = await loadStored(guard.organizationId);
    const applied = applyOrgBackendMutation(stored, parsed.value, sealString);
    if (!applied.ok) return jsonError(applied.status, applied.error);

    const admin = createAdminClient();
    const { error } = await admin
      .from("organizations")
      .update(orgBackendUpdateRow(applied.next))
      .eq("id", guard.organizationId);
    if (error) {
      console.error("[org-backends] save failed:", error);
      return jsonError(500, "Failed to save backends");
    }

    return NextResponse.json({ backends: presentOrgBackends(applied.next) });
  } catch (error) {
    console.error("Organization backends save error:", error);
    return jsonError(500, "Internal server error");
  }
}
