import { ScoutTapClient } from "@/components/scout-tap/ScoutTapClient";
import { resolveInitialMinutes } from "@/lib/tap-score-client-helpers";

interface PageProps {
  params: Promise<{ id: string }>;
  searchParams: Promise<{
    sessionId?: string;
    blockId?: string;
    block?: string;
    minutes?: string;
  }>;
}

function parseLaunchMinutes(raw: string | undefined): number | undefined {
  if (raw == null || raw === "") return undefined;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return undefined;
  return resolveInitialMinutes(Math.trunc(n) * 60);
}

export default async function WorkspaceScoutPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { sessionId, blockId, block, minutes } = await searchParams;
  const initialMinutes = parseLaunchMinutes(minutes);

  return (
    <ScoutTapClient
      workspaceId={id}
      sessionId={sessionId}
      blockId={blockId || block}
      initialMinutes={initialMinutes}
      lockDuration={initialMinutes != null}
    />
  );
}
