import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addCustomAestheticUrls,
  authorizeCustomAestheticEdit,
  readCustomAestheticUrls,
  removeCustomAestheticUrl,
} from "@/lib/organization/custom-aesthetic-set";
import {
  applyCustomAestheticUploads,
  ORG_AESTHETICS_BUCKET,
  parseCustomAestheticPayload,
} from "@/lib/organization/custom-aesthetics";

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

async function loadStoredUrls(
  orgId: string,
): Promise<{ ok: true; urls: string[] } | { ok: false }> {
  const adminClient = createAdminClient();
  const { data, error } = await adminClient
    .from("organizations")
    .select("custom_aesthetic_urls")
    .eq("id", orgId)
    .single();
  if (error) {
    console.error("[org-aesthetics] read failed:", error);
    return { ok: false };
  }
  return { ok: true, urls: readCustomAestheticUrls(data?.custom_aesthetic_urls) };
}

async function saveUrls(orgId: string, urls: string[]) {
  const adminClient = createAdminClient();
  const { error } = await adminClient
    .from("organizations")
    .update({
      custom_aesthetic_urls: urls,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orgId);
  return error;
}

// GET /api/organization/aesthetics — current org set (empty means system defaults)
export async function GET() {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const profile = await loadProfile(auth.user.id, auth.supabase);
    if (!profile?.organization_id) {
      return NextResponse.json({ images: [] });
    }
    const stored = await loadStoredUrls(profile.organization_id);
    if (!stored.ok) return jsonError(500, "Failed to load custom aesthetics");
    return NextResponse.json({ images: stored.urls });
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

    const stored = await loadStoredUrls(guard.organizationId);
    if (!stored.ok) return jsonError(500, "Failed to load custom aesthetics");
    const current = stored.urls;
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

    const images = addCustomAestheticUrls(current, published);
    const updateError = await saveUrls(guard.organizationId, images);
    if (updateError) {
      console.error("[org-aesthetics] failed to save urls:", updateError);
      return jsonError(500, "Images uploaded but failed to save on organization");
    }

    return NextResponse.json({ images });
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

    const stored = await loadStoredUrls(guard.organizationId);
    if (!stored.ok) return jsonError(500, "Failed to load custom aesthetics");
    const images = removeCustomAestheticUrl(stored.urls, url);
    const updateError = await saveUrls(guard.organizationId, images);
    if (updateError) {
      console.error("[org-aesthetics] failed to remove url:", updateError);
      return jsonError(500, "Failed to remove image");
    }

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Organization aesthetics delete error:", error);
    return jsonError(500, "Internal server error");
  }
}
