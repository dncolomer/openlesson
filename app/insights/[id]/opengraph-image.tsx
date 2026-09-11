import { composeOgImage, composeStandardOgImage, OG_CONTENT_TYPE, OG_SIZE } from "@/lib/og/compose";
import { getPublicInsightForMeta } from "@/lib/insights-server";
import { buildInsightOgShareInput } from "@/lib/insight-share";

export const runtime = "nodejs";
export const alt = "Insight — Uncertain Systems";
export const size = OG_SIZE;
export const contentType = OG_CONTENT_TYPE;

/** Dynamic per-insight share card: title + aesthetic, not the unsys standard. */
export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const insight = await getPublicInsightForMeta(id);
  if (!insight) return composeStandardOgImage();
  return composeOgImage(buildInsightOgShareInput(insight));
}
