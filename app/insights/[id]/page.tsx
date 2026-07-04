import { InsightDetailClient } from "@/components/InsightDetailClient";

export default async function InsightPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <InsightDetailClient insightId={id} />;
}