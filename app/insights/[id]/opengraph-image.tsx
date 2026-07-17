import {
  composeOgImageFromSurface,
  OG_CONTENT_TYPE,
  OG_SIZE,
} from "@/lib/og/compose";
import { getOgSurface } from "@/lib/og/surfaces";
import {
  getPublicInsightForMeta,
  insightPublicSlug,
  resolveInsightAestheticImage,
} from "@/lib/insights-server";

export const alt = "Uncertain Systems insight";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

interface ImageProps {
  params: Promise<{ id: string }>;
}

export default async function Image({ params }: ImageProps) {
  const { id } = await params;
  const insight = await getPublicInsightForMeta(id);
  const surface = getOgSurface("insight");
  const title = insight?.title || surface.title;
  const description = insight?.summary || surface.description;
  const aestheticPath = resolveInsightAestheticImage(insight?.aesthetic_image);
  const siteLabel = insight
    ? `uncertain.systems/insights/${insightPublicSlug(insight)}`
    : "uncertain.systems";

  return composeOgImageFromSurface(surface, {
    title,
    description,
    aestheticPath,
    aestheticSeed: insight?.id || id,
    siteLabel,
  });
}
