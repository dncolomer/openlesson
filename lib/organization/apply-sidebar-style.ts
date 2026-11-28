import type { SupabaseClient } from "@supabase/supabase-js";
import {
  addCustomAestheticUrls,
} from "@/lib/organization/custom-aesthetic-set";
import {
  applyCustomAestheticUploads,
  ORG_AESTHETICS_BUCKET,
} from "@/lib/organization/custom-aesthetics";
import { generateSessionSidebarStyle } from "@/lib/organization/sidebar-style-generate";
import {
  clampSidebarStylePrompt,
  EMPTY_SESSION_SIDEBAR_STYLE,
  parseSessionCanvasStyle,
  type SessionSidebarStyle,
} from "@/lib/session-sidebar-style";

export type SidebarStyleMutationBody = {
  prompt?: unknown;
  reset?: unknown;
  canvas?: unknown;
  backgroundImage?: unknown;
};

export async function applySidebarStyleBody(input: {
  admin: SupabaseClient;
  organizationId: string;
  urls: string[];
  style: SessionSidebarStyle;
  body: SidebarStyleMutationBody;
}): Promise<
  | { ok: true; urls: string[]; style: SessionSidebarStyle }
  | { ok: false; status: number; error: string }
> {
  const { admin, organizationId, body } = input;

  if (body.reset === true) {
    return { ok: true, urls: input.urls, style: EMPTY_SESSION_SIDEBAR_STYLE };
  }

  if (body.canvas != null && !clampSidebarStylePrompt(body.prompt) && body.reset !== true) {
    return {
      ok: true,
      urls: input.urls,
      style: {
        ...input.style,
        canvas: parseSessionCanvasStyle(body.canvas),
      },
    };
  }

  if (
    body.backgroundImage != null &&
    !clampSidebarStylePrompt(body.prompt) &&
    body.reset !== true
  ) {
    const backgroundImage = String(body.backgroundImage || "").trim() || null;
    return {
      ok: true,
      urls: input.urls,
      style: { ...input.style, backgroundImage },
    };
  }

  const prompt = clampSidebarStylePrompt(body.prompt);
  if (!prompt) return { ok: false, status: 400, error: "prompt is required" };

  const generated = await generateSessionSidebarStyle({
    prompt,
    assetUrls: input.urls,
    canvas: input.style.canvas,
  });
  let urls = input.urls;
  let backgroundImage = input.style.backgroundImage;
  if (generated.still) {
    const prepared = applyCustomAestheticUploads({
      current: urls,
      organizationId,
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

  return {
    ok: true,
    urls,
    style: { ...generated.style, backgroundImage },
  };
}
