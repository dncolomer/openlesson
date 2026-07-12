import type { Metadata } from "next";
import { InsightDetailClient } from "@/components/InsightDetailClient";
import { getPublicInsightForMeta, insightPublicSlug } from "@/lib/insights-server";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const insight = await getPublicInsightForMeta(id);

  if (!insight) {
    return { title: "Insight" };
  }

  const title = insight.title;
  const description = insight.summary;
  const slug = insightPublicSlug(insight);
  const ogImage = `/insights/${slug}/opengraph-image`;
  const images = [{ url: ogImage, width: 1200, height: 630, alt: title }];

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: "article",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: images.map((image) => image.url),
    },
  };
}

export default async function InsightPage({ params }: PageProps) {
  const { id } = await params;
  return <InsightDetailClient insightId={id} />;
}