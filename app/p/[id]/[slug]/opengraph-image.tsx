import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import {
  composeOgImageFromSurface,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og/compose";
import { getOgSurface } from "@/lib/og/surfaces";
import { toAestheticsPublicPath } from "@/lib/og/aesthetic";

export const alt = "Workspace";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface ImageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

function formatTitle(slug: string): string {
  const decoded = decodeURIComponent(slug);
  return decoded
    .replace(/-/g, " ")
    .split(" ")
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(" ");
}

async function getPlanData(workspaceId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll() {},
    },
  });

  const { data } = await supabase
    .from("workspaces")
    .select("title, root_topic, cover_image_url, description")
    .eq("id", workspaceId)
    .eq("is_public", true)
    .single();

  return data;
}

export default async function Image({ params }: ImageProps) {
  const { id, slug } = await params;
  const planData = await getPlanData(id);
  const surface = getOgSurface("public-workspace");
  const title =
    planData?.title || planData?.root_topic || formatTitle(slug) || surface.title;
  const description =
    (typeof planData?.description === "string" && planData.description.trim()) ||
    surface.description;
  const preferredAesthetic = toAestheticsPublicPath(planData?.cover_image_url);

  return composeOgImageFromSurface(surface, {
    title,
    description,
    aestheticPath: preferredAesthetic,
    aestheticSeed: id,
    siteLabel: "uncertain.systems",
  });
}
