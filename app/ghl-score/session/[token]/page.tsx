import { notFound } from "next/navigation";
import { GhcScoreClient } from "@/components/GhcScoreClient";
import { hashPrivateToken } from "@/lib/ghc-score";
import { createAdminClient } from "@/lib/supabase/admin";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PrivateGhlScorePage({ params }: PageProps) {
  const { token } = await params;
  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  const { data: session } = await supabase
    .from("workspace_ghc_sessions")
    .select("id, plan_id, plan_node_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, learning_plans:title")
    .eq("private_token_hash", tokenHash)
    .single();

  if (!session) notFound();

  const initialSession = {
    ...session,
    workspaceTitle: (session as any).learning_plans?.title || "Workspace",
  };

  return <GhcScoreClient privateToken={token} sessionId={session.session_id || undefined} planNodeId={session.plan_node_id || undefined} initialSession={initialSession} />;
}
