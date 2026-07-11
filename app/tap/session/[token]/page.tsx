import { notFound } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
import { hashPrivateToken } from "@/lib/tap-score";
import { createAdminClient } from "@/lib/supabase/admin";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PrivateTapSessionPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  const { data: session } = await supabase
    .from("workspace_tap_sessions")
    .select("id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, workspaces(title)")
    .eq("private_token_hash", tokenHash)
    .single();

  if (!session) notFound();

  const initialSession = {
    ...session,
    workspaceTitle: (session as any).workspaces?.title || "Workspace",
  };

  return (
    <TapScoreClient
      workspaceId={session.workspace_id}
      privateToken={token}
      sessionId={session.session_id || undefined}
      blockId={session.block_id || undefined}
      initialSession={initialSession}
    />
  );
}
