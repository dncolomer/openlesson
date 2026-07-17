import { createClient } from "@/lib/supabase/server";

export const INSIGHT_AESTHETIC_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/Greco-futurism/HH_toqAbwAAKiMu.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/lunar/HE2xzURWUAAd6N2.jpeg",
];

export type PublicInsightMeta = {
  id: string;
  share_token: string | null;
  title: string;
  summary: string;
  aesthetic_image: string | null;
};

const SITE_ORIGIN =
  process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "https://uncertain.systems");

export function insightPublicSlug(insight: Pick<PublicInsightMeta, "id" | "share_token">) {
  return insight.share_token || insight.id;
}

export function absoluteSiteUrl(path: string) {
  if (path.startsWith("http://") || path.startsWith("https://")) return path;
  return `${SITE_ORIGIN}${path.startsWith("/") ? path : `/${path}`}`;
}

export function resolveInsightAestheticImage(aestheticImage?: string | null) {
  const candidate = aestheticImage?.trim();
  // Only accept aesthetics-folder paths for OG/share cards.
  if (candidate?.startsWith("/aesthetics/")) return candidate;
  return INSIGHT_AESTHETIC_IMAGES[0];
}

export async function getPublicInsightForMeta(id: string): Promise<PublicInsightMeta | null> {
  const supabase = await createClient();
  const { data: insight, error } = await supabase
    .from("insights")
    .select("id, share_token, title, summary, aesthetic_image, is_public, archived_at")
    .or(`id.eq.${id},share_token.eq.${id}`)
    .maybeSingle();

  if (error || !insight || insight.archived_at || !insight.is_public) {
    return null;
  }

  return {
    id: insight.id,
    share_token: insight.share_token,
    title: insight.title,
    summary: insight.summary,
    aesthetic_image: insight.aesthetic_image,
  };
}