import { notFound, redirect } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
import { hashPrivateToken } from "@/lib/tap-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PrivateTapSessionPage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  const { data: session } = await supabase
    .from("workspace_tap_sessions")
    .select(
      "id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, assigned_user_id, post_session, redirect_url, workspaces(title)"
    )
    .eq("private_token_hash", tokenHash)
    .single();

  if (!session) notFound();

  if (session.assigned_user_id) {
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (!user) {
      redirect(`/login?redirect=${encodeURIComponent(`/tap/session/${token}`)}`);
    }
    if (user.id !== session.assigned_user_id) {
      notFound();
    }
  }

  const initialSession = {
    ...session,
    workspaceTitle: (session as { workspaces?: { title?: string } }).workspaces?.title || "Workspace",
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