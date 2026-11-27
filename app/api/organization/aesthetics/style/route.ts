import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { authorizeCustomAestheticEdit } from "@/lib/organization/custom-aesthetic-set";
import { loadOrgAesthetics, saveOrgAesthetics } from "@/lib/organization/aesthetics-store";
import { applySidebarStyleBody } from "@/lib/organization/apply-sidebar-style";
import { syncDefaultProtocolSettingStyle } from "@/lib/organization/protocol-settings-store";

export const runtime = "nodejs";
export const maxDuration = 60;

type AestheticProfile = {
  organization_id?: string | null;
  is_org_admin?: boolean | null;
};

async function loadProfile(userId: string, supabase: { from: (table: string) => any }) {
  const { data: profile, error } = await supabase
    .from("profiles")
    .select("organization_id, is_org_admin, is_admin")
    .eq("id", userId)
    .single();
  if (error || !profile) return null;
  return profile as AestheticProfile;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json().catch(() => ({}))) as {
      prompt?: unknown;
      reset?: unknown;
      canvas?: unknown;
    };
    const profile = await loadProfile(auth.user.id, auth.supabase);
    const guard = authorizeCustomAestheticEdit(profile);
    if (!guard.ok) return jsonError(guard.status, guard.error);

    const admin = createAdminClient();
    const loaded = await loadOrgAesthetics(admin, guard.organizationId);
    if (!loaded.ok) return jsonError(500, "Failed to load custom aesthetics");

    const applied = await applySidebarStyleBody({
      admin,
      organizationId: guard.organizationId,
      urls: loaded.stored.urls,
      style: loaded.stored.style,
      body,
    });
    if (!applied.ok) return jsonError(applied.status, applied.error);

    const stored = { urls: applied.urls, style: applied.style };
    const saved = await saveOrgAesthetics(admin, guard.organizationId, stored);
    if (saved.error) {
      return jsonError(500, body.reset === true ? "Failed to reset sidebar style" : "Failed to save sidebar style");
    }
    await syncDefaultProtocolSettingStyle(admin, guard.organizationId, stored.style);
    return NextResponse.json({ images: stored.urls, style: stored.style });
  } catch (error) {
    console.error("Organization sidebar style error:", error);
    return jsonError(500, "Failed to style the sidebar");
  }
}
