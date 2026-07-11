import { GhcScoreClient } from "@/components/GhcScoreClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string; blockId?: string }>;
}

export default async function GhlScorePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, blockId } = await searchParams;
  return <GhcScoreClient workspaceId={id} sessionId={sessionId} blockId={blockId} />;
}
