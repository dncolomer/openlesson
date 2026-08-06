import type { Metadata } from "next";
import { InsightDetailClient } from "@/components/InsightDetailClient";
import { getPublicInsightForMeta } from "@/lib/insights-server";
import { standardShareSocialMetadata } from "@/lib/og/standard";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const insight = await getPublicInsightForMeta(id);

  if (!insight) {
    return { title: "Insight" };
  }

  // Page SEO title/description stay entity-specific; social share is unsys standard.
  const social = standardShareSocialMetadata();
  return {
    title: insight.title,
    description: insight.summary,
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function InsightPage({ params }: PageProps) {
  const { id } = await params;
  return <InsightDetailClient insightId={id} />;
}