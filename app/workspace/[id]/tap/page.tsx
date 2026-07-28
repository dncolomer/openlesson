import { TapScoreClient } from "@/components/TapScoreClient";
import { ExerciseTapClient } from "@/components/ExerciseTapClient";
import { resolveTapShellFromSession } from "@/lib/exercise-tap";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sessionId?: string;
    blockId?: string;
    interactionKind?: string;
    interaction_kind?: string;
  }>;
}

export default async function GhlScorePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, blockId, interactionKind, interaction_kind } = await searchParams;
  const shell = resolveTapShellFromSession({
    interactionKind: interactionKind ?? interaction_kind,
  });

  if (shell === "exercise") {
    return (
      <ExerciseTapClient workspaceId={id} sessionId={sessionId} blockId={blockId} />
    );
  }

  return <TapScoreClient workspaceId={id} sessionId={sessionId} blockId={blockId} />;
}
