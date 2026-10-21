import { TapScoreClient } from "@/components/TapScoreClient";
import { resolveInitialMinutes } from "@/lib/tap-score-client-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sessionId?: string;
    blockId?: string;
    interactionKind?: string;
    interaction_kind?: string;
    minutes?: string;
    session?: string;
  }>;
}

function parseLaunchMinutes(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return resolveInitialMinutes(Math.trunc(n) * 60);
}

export default async function WorkspaceVerifyPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, blockId, minutes } = await searchParams;
  const initialMinutes = parseLaunchMinutes(minutes);

  return (
    <TapScoreClient
      workspaceId={id}
      sessionId={sessionId}
      blockId={blockId}
      initialMinutes={initialMinutes}
      lockDuration={initialMinutes != null}
      sidebarMode="verification-tap"
    />
  );
}
