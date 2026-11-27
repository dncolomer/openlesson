import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  addCustomAestheticUrls,
  authorizeCustomAestheticEdit,
} from "@/lib/organization/custom-aesthetic-set";
import {
  applyCustomAestheticUploads,
  ORG_AESTHETICS_BUCKET,
} from "@/lib/organization/custom-aesthetics";
import { loadOrgAesthetics, saveOrgAesthetics } from "@/lib/organization/aesthetics-store";
import { generateSessionSidebarStyle } from "@/lib/organization/sidebar-style-generate";
import {
  clampSidebarStylePrompt,
  EMPTY_SESSION_SIDEBAR_STYLE,
  parseSessionCanvasStyle,
} from "@/lib/session-sidebar-style";

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

    if (body.reset === true) {
      const stored = { urls: loaded.stored.urls, style: EMPTY_SESSION_SIDEBAR_STYLE };
      const saved = await saveOrgAesthetics(admin, guard.organizationId, stored);
      if (saved.error) return jsonError(500, "Failed to reset sidebar style");
      return NextResponse.json({ images: stored.urls, style: stored.style });
    }

    if (body.canvas != null && !clampSidebarStylePrompt(body.prompt) && body.reset !== true) {
      const stored = {
        urls: loaded.stored.urls,
        style: {
          ...loaded.stored.style,
          canvas: parseSessionCanvasStyle(body.canvas),
        },
      };
      const saved = await saveOrgAesthetics(admin, guard.organizationId, stored);
      if (saved.error) return jsonError(500, "Failed to save sidebar style");
      return NextResponse.json({ images: stored.urls, style: stored.style });
    }

    const prompt = clampSidebarStylePrompt(body.prompt);
    if (!prompt) return jsonError(400, "prompt is required");

    const generated = await generateSessionSidebarStyle({
      prompt,
      assetUrls: loaded.stored.urls,
    });
    let urls = loaded.stored.urls;
    let backgroundImage = loaded.stored.style.backgroundImage;
    if (generated.still) {
      const prepared = applyCustomAestheticUploads({
        current: urls,
        organizationId: guard.organizationId,
        uploads: [
          {
            data: generated.still.bytes.toString("base64"),
            mimeType: generated.still.contentType,
            fileName: `sidebar-style.${generated.still.contentType === "image/png" ? "png" : generated.still.contentType === "image/webp" ? "webp" : "jpg"}`,
          },
        ],
        publicBaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
      });
      if (prepared.ok) {
        const image = prepared.added[0];
        if (image) {
          const { error: uploadError } = await admin.storage
            .from(ORG_AESTHETICS_BUCKET)
            .upload(image.storagePath, image.bytes, {
              contentType: image.contentType,
              upsert: true,
              cacheControl: "3600",
            });
          if (!uploadError) {
            const { data: publicData } = admin.storage
              .from(ORG_AESTHETICS_BUCKET)
              .getPublicUrl(image.storagePath);
            const published = publicData.publicUrl || image.url;
            urls = addCustomAestheticUrls(urls, [published]);
            backgroundImage = published;
          }
        }
      }
    }

    const stored = {
      urls,
      style: { ...generated.style, backgroundImage },
    };
    const saved = await saveOrgAesthetics(admin, guard.organizationId, stored);
    if (saved.error) return jsonError(500, "Failed to save sidebar style");
    return NextResponse.json({ images: stored.urls, style: stored.style });
  } catch (error) {
    console.error("Organization sidebar style error:", error);
    return jsonError(500, "Failed to style the sidebar");
  }
}
