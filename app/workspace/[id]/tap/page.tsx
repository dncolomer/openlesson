import { TapScoreClient } from "@/components/TapScoreClient";
import { ExerciseTapClient } from "@/components/ExerciseTapClient";
import { resolveTapShellFromSession } from "@/lib/exercise-tap";
import { resolveInitialMinutes } from "@/lib/tap-score-client-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sessionId?: string;
    blockId?: string;
    interactionKind?: string;
    interaction_kind?: string;
    /** Pre-selected session length from workspace launch (minutes). */
    minutes?: string;
  }>;
}

function parseLaunchMinutes(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  // Reuse the same bounds/normalization TAP uses for requested duration.
  return resolveInitialMinutes(Math.trunc(n) * 60);
}

export default async function GhlScorePage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, blockId, interactionKind, interaction_kind, minutes } =
    await searchParams;
  const shell = resolveTapShellFromSession({
    interactionKind: interactionKind ?? interaction_kind,
  });
  const initialMinutes = parseLaunchMinutes(minutes);

  if (shell === "exercise") {
    return (
      <ExerciseTapClient
        workspaceId={id}
        sessionId={sessionId}
        blockId={blockId}
        initialMinutes={initialMinutes}
        lockDuration={initialMinutes != null}
      />
    );
  }

  return (
    <TapScoreClient
      workspaceId={id}
      sessionId={sessionId}
      blockId={blockId}
      initialMinutes={initialMinutes}
      lockDuration={initialMinutes != null}
    />
  );
}
