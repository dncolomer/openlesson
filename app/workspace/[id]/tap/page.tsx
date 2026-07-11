import { TapScoreClient } from "@/components/TapScoreClient";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ sessionId?: string; blockId?: string }>;
}

export default async function GhlScorePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, blockId } = await searchParams;
  return <TapScoreClient workspaceId={id} sessionId={sessionId} blockId={blockId} />;
}
