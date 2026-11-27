import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addCustomAestheticUrls,
  authorizeCustomAestheticEdit,
  removeCustomAestheticUrl,
} from "@/lib/organization/custom-aesthetic-set";
import {
  applyCustomAestheticUploads,
  ORG_AESTHETICS_BUCKET,
  parseCustomAestheticPayload,
} from "@/lib/organization/custom-aesthetics";
import { loadOrgAesthetics, saveOrgAesthetics } from "@/lib/organization/aesthetics-store";
import { EMPTY_SESSION_SIDEBAR_STYLE } from "@/lib/session-sidebar-style";

export const runtime = "nodejs";

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

function presentAesthetics(stored: { urls: string[]; style: typeof EMPTY_SESSION_SIDEBAR_STYLE }) {
  return { images: stored.urls, style: stored.style };
}

// GET /api/organization/aesthetics — current org set (empty means system defaults)
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const profile = await loadProfile(auth.user.id, auth.supabase);
    if (!profile?.organization_id) {
      return NextResponse.json(presentAesthetics({ urls: [], style: EMPTY_SESSION_SIDEBAR_STYLE }));
    }
    const loaded = await loadOrgAesthetics(createAdminClient(), profile.organization_id);
    if (!loaded.ok) return jsonError(500, "Failed to load custom aesthetics");
    return NextResponse.json(presentAesthetics(loaded.stored));
  } catch (error) {
    console.error("Organization aesthetics read error:", error);
    return jsonError(500, "Internal server error");
  }
}

// POST /api/organization/aesthetics — org admin adds one or more raster images
export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const uploads = parseCustomAestheticPayload(body);
    if (!uploads) {
      return jsonError(400, "images[].data and images[].mimeType are required");
    }

    const profile = await loadProfile(auth.user.id, auth.supabase);
    const guard = authorizeCustomAestheticEdit(profile);
    if (!guard.ok) return jsonError(guard.status, guard.error);

    const loaded = await loadOrgAesthetics(createAdminClient(), guard.organizationId);
    if (!loaded.ok) return jsonError(500, "Failed to load custom aesthetics");
    const current = loaded.stored.urls;
    const prepared = applyCustomAestheticUploads({
      current,
      organizationId: guard.organizationId,
      uploads,
      publicBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
    });
    if (!prepared.ok) {
      return jsonError(prepared.status, prepared.error);
    }

    const adminClient = createAdminClient();
    const published: string[] = [];
    for (const image of prepared.added) {
      const { error: uploadError } = await adminClient.storage
        .from(ORG_AESTHETICS_BUCKET)
        .upload(image.storagePath, image.bytes, {
          contentType: image.contentType,
          upsert: true,
          cacheControl: "3600",
        });
      if (uploadError) {
        console.error("[org-aesthetics] upload failed:", uploadError);
        return jsonError(500, "Failed to upload image");
      }
      const { data: publicData } = adminClient.storage
        .from(ORG_AESTHETICS_BUCKET)
        .getPublicUrl(image.storagePath);
      published.push(publicData.publicUrl || image.url);
    }

    const stored = {
      urls: addCustomAestheticUrls(current, published),
      style: loaded.stored.style,
    };
    const updateError = await saveOrgAesthetics(adminClient, guard.organizationId, stored);
    if (updateError.error) {
      console.error("[org-aesthetics] failed to save urls:", updateError.error);
      return jsonError(500, "Images uploaded but failed to save on organization");
    }

    return NextResponse.json(presentAesthetics(stored));
  } catch (error) {
    console.error("Organization aesthetics upload error:", error);
    return jsonError(500, "Internal server error");
  }
}

// DELETE /api/organization/aesthetics — org admin removes one image from the set
export async function DELETE(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;

    const body = await req.json().catch(() => ({}));
    const url = typeof (body as { url?: unknown }).url === "string"
      ? (body as { url: string }).url.trim()
      : "";
    if (!url) return jsonError(400, "url is required");

    const profile = await loadProfile(auth.user.id, auth.supabase);
    const guard = authorizeCustomAestheticEdit(profile);
    if (!guard.ok) return jsonError(guard.status, guard.error);

    const adminClient = createAdminClient();
    const loaded = await loadOrgAesthetics(adminClient, guard.organizationId);
    if (!loaded.ok) return jsonError(500, "Failed to load custom aesthetics");
    const images = removeCustomAestheticUrl(loaded.stored.urls, url);
    const style =
      loaded.stored.style.backgroundImage === url
        ? { ...loaded.stored.style, backgroundImage: images[0] || null }
        : loaded.stored.style;
    const stored = { urls: images, style };
    const updateError = await saveOrgAesthetics(adminClient, guard.organizationId, stored);
    if (updateError.error) {
      console.error("[org-aesthetics] failed to remove url:", updateError.error);
      return jsonError(500, "Failed to remove image");
    }

    return NextResponse.json(presentAesthetics(stored));
  } catch (error) {
    console.error("Organization aesthetics delete error:", error);
    return jsonError(500, "Internal server error");
  }
}
