import type { Metadata } from "next";
import { InsightDetailClient } from "@/components/InsightDetailClient";
import { getPublicInsightForMeta } from "@/lib/insights-server";
import { insightShareSocialMetadata } from "@/lib/insight-share";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const insight = await getPublicInsightForMeta(id);

  if (!insight) {
    return { title: "Insight" };
  }

  const social = insightShareSocialMetadata(insight);
  return {
    title: social.title,
    description: social.description,
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function InsightPage({ params }: PageProps) {
  const { id } = await params;
  return <InsightDetailClient insightId={id} />;
}
