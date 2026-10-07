import { redirect } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
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
    /** Learning-workspace Verify launch. */
    session?: string;
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
  const { sessionId, blockId, minutes, session } = await searchParams;
  const initialMinutes = parseLaunchMinutes(minutes);

  // Learn, Calibrate, and Verify are the only sessions. This route is Verify.
  if (session !== "verification") {
    redirect(`/workspace/${id}`);
  }

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
