import { notFound, redirect } from "next/navigation";
import { TapScoreClient } from "@/components/TapScoreClient";
import { hashPrivateToken } from "@/lib/tap-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  collectEntryQueryParams,
  recordGuestLinkEntryQueryParams,
} from "@/lib/guest-link-access";
import { buildPowParticipantIdentity } from "@/lib/session-participant-identity";
import { resolveGuestForLinkQueryParams } from "@/lib/guest-link-query-guest";

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
      "id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, assigned_user_id, guest_user_id, organization_id, user_id, post_session, redirect_url, show_end_session, workspaces(title, user_id)"
    )
    .eq("private_token_hash", tokenHash)
    .maybeSingle();
  session = byHash;

  // Legacy public rows still open.
  if (!session) {
    const { data: byPublic } = await supabase
      .from("workspace_tap_sessions")
      .select(
        "id, workspace_id, block_id, session_id, status, requested_duration_seconds, mode, voice_id, analysis, overall_score, marker_scores, assigned_user_id, guest_user_id, organization_id, user_id, post_session, redirect_url, show_end_session, workspaces(title, user_id)"
      )
      .eq("public_token", token)
      .eq("access_mode", "public")
      .maybeSingle();
    session = byPublic;
  }

  if (!session) notFound();

  if (session.status === "revoked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <p className="text-sm text-red-400">This TAP link has been revoked</p>
      </div>
    );
  }

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

  const entryParams = collectEntryQueryParams(query);
  if (Object.keys(entryParams).length > 0 && typeof session.id === "string") {
    await recordGuestLinkEntryQueryParams(
      supabase,
      "workspace_tap_sessions",
      session.id,
      entryParams,
    ).catch(() => {});
  }

  // Resolve (and warm-create) guest subject so badge + first PoW match.
  let resolvedGuestUserId = (session.guest_user_id as string | null) ?? null;
  if (!session.assigned_user_id && typeof session.id === "string") {
    const workspaces = session.workspaces as
      | { user_id?: string }
      | Array<{ user_id?: string }>
      | undefined;
    const wsOwner = Array.isArray(workspaces) ? workspaces[0]?.user_id : workspaces?.user_id;
    const ownerUserId = (session.user_id as string | null) || wsOwner || null;
    if (ownerUserId) {
      try {
        const resolved = await resolveGuestForLinkQueryParams(supabase, {
          linkKind: "tap",
          linkId: session.id,
          workspaceId: String(session.workspace_id),
          organizationId: (session.organization_id as string | null) ?? null,
          ownerUserId,
          baseGuestUserId: resolvedGuestUserId,
          params: entryParams,
        });
        if (resolved.guestUserId) resolvedGuestUserId = resolved.guestUserId;
      } catch {
        // API access path will provision if needed
      }
    }
  }

  const workspaces = session.workspaces as { title?: string } | { title?: string }[] | undefined;
  const workspaceTitle = Array.isArray(workspaces)
    ? workspaces[0]?.title
    : workspaces?.title;

  const showEndSession = session.show_end_session !== false;
  const initialSession = {
    ...session,
    guest_user_id: resolvedGuestUserId,
    workspaceTitle: workspaceTitle || "Workspace",
    show_end_session: showEndSession,
  };

  const participantIdentity = buildPowParticipantIdentity({
    guestUserId: resolvedGuestUserId,
    assignedUserId: (session.assigned_user_id as string | null) ?? null,
  });

  return (
    <TapScoreClient
      workspaceId={String(session.workspace_id)}
      privateToken={token}
      sessionId={(session.session_id as string) || undefined}
      blockId={(session.block_id as string) || undefined}
      initialSession={initialSession}
      showEndSession={showEndSession}
      entryQueryParams={entryParams}
      participantIdentity={participantIdentity}
    />
  );
}
