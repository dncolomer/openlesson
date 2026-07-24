import { notFound, redirect } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
import { hashPrivateToken } from "@/lib/tap-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  collectEntryQueryParams,
  recordGuestLinkEntryQueryParams,
} from "@/lib/guest-link-access";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrivateTapSessionPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  let session: Record<string, unknown> | null = null;
  const { data: byHash } = await supabase
    .from("workspace_tap_sessions")
    .select(
      "id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, assigned_user_id, post_session, redirect_url, access_mode, public_token, show_end_session, workspaces(title)"
    )
    .eq("private_token_hash", tokenHash)
    .maybeSingle();
  session = byHash;

  if (!session) {
    const { data: byPublic } = await supabase
      .from("workspace_tap_sessions")
      .select(
        "id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, assigned_user_id, post_session, redirect_url, access_mode, public_token, show_end_session, workspaces(title)"
      )
      .eq("public_token", token)
      .eq("access_mode", "public")
      .maybeSingle();
    session = byPublic;
  }

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

  // Persist all URL query params for later reference (esp. public campaign links).
  const entryParams = collectEntryQueryParams(query);
  if (Object.keys(entryParams).length > 0 && typeof session.id === "string") {
    await recordGuestLinkEntryQueryParams(
      supabase,
      "workspace_tap_sessions",
      session.id,
      entryParams,
    ).catch(() => {});
  }

  const workspaces = session.workspaces as { title?: string } | { title?: string }[] | undefined;
  const workspaceTitle = Array.isArray(workspaces)
    ? workspaces[0]?.title
    : workspaces?.title;

  const showEndSession = session.show_end_session !== false;
  const initialSession = {
    ...session,
    workspaceTitle: workspaceTitle || "Workspace",
    show_end_session: showEndSession,
  };

  return (
    <TapScoreClient
      workspaceId={String(session.workspace_id)}
      privateToken={token}
      sessionId={(session.session_id as string) || undefined}
      blockId={(session.block_id as string) || undefined}
      initialSession={initialSession}
      showEndSession={showEndSession}
    />
  );
}
