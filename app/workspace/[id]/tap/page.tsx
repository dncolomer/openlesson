import { GhcScoreClient } from "@/components/GhcScoreClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string; planNodeId?: string }>;
}

export default async function GhlScorePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, planNodeId } = await searchParams;
  return <GhcScoreClient planId={id} sessionId={sessionId} planNodeId={planNodeId} />;
}
