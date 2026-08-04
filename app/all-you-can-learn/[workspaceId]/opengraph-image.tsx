import {
  composeOgImageFromSurface,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og/compose";
import { getOgSurface } from "@/lib/og/surfaces";
import { createAdminClient } from "@/lib/supabase/admin";
import { assembleAyclLandingSummary } from "@/lib/aycl-landing";

export const alt = "All-You-Can-Learn workspace";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface ImageProps {
  params: Promise<{ workspaceId: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { workspaceId } = await params;
  const id = String(workspaceId || "").trim();
  let title = "All-You-Can-Learn";
  let description =
    "Curated lifetime learning environments — pay once, fork privately, learn at your pace.";
  let aestheticSeed = id || "aycl-landing";

  try {
    if (id) {
      const supabase = createAdminClient();
      const { data: workspace } = await supabase
        .from("workspaces")
        .select(
          "id, title, root_topic, description, workspace_goal, notes, cover_image_url, is_all_you_can_learn",
        )
        .eq("id", id)
        .eq("is_all_you_can_learn", true)
        .maybeSingle();
      if (workspace) {
        const landing = assembleAyclLandingSummary({
          workspace,
          blocks: [],
        });
        title = landing.title;
        description = landing.summary.slice(0, 160);
        aestheticSeed = landing.workspaceId;
      }
    }
  } catch {
    /* fall through to defaults */
  }

  const surface = getOgSurface("pricing");
  return composeOgImageFromSurface(surface, {
    title,
    description,
    eyebrow: "All-You-Can-Learn",
    footerLabel: "Lifetime access",
    aestheticSeed,
    siteLabel: id
      ? `uncertain.systems/all-you-can-learn/${id.slice(0, 8)}…`
      : "uncertain.systems/all-you-can-learn",
  });
}
