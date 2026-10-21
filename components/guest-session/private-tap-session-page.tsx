import { notFound, redirect } from "next/navigation";
import { ScoutTapClient } from "@/components/scout-tap/ScoutTapClient";
import { TapScoreClient } from "@/components/TapScoreClient";
import { hashPrivateToken } from "@/lib/tap-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import {
  collectEntryQueryParams,
  flowSessionPath,
  recordGuestLinkEntryQueryParams,
} from "@/lib/guest-link-access";
import {
  CALIBRATE_SESSIONS_TABLE,
  GUEST_SESSION_OPEN_SELECT,
  VERIFY_SESSIONS_TABLE,
  findCalibrateOrVerifySessionByToken,
  findCalibrateSessionByToken,
  findVerifySessionByToken,
  guestFlowFromStoredKind,
  type CalibrateVerifyTable,
} from "@/lib/guest-session-tables";
import { buildPowParticipantIdentity } from "@/lib/session-participant-identity";
import { resolveGuestForLinkQueryParams } from "@/lib/guest-link-query-guest";
import { resolveTapShellFromSession } from "@/lib/exercise-tap";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
  flow?: "calibrate" | "verify";
}

export default async function PrivateTapSessionPage({ params, searchParams, flow }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);

  let table: CalibrateVerifyTable = flow === "calibrate" ? CALIBRATE_SESSIONS_TABLE : VERIFY_SESSIONS_TABLE;
  let session: Record<string, unknown> | null = null;
  if (flow === "calibrate") {
    session = await findCalibrateSessionByToken(supabase, tokenHash, token, GUEST_SESSION_OPEN_SELECT);
  } else if (flow === "verify") {
    session = await findVerifySessionByToken(supabase, tokenHash, token, GUEST_SESSION_OPEN_SELECT);
  } else {
    const found = await findCalibrateOrVerifySessionByToken(
      supabase,
      tokenHash,
      token,
      GUEST_SESSION_OPEN_SELECT,
    );
    session = found?.session ?? null;
    if (found) table = found.table;
  }

  if (!session) notFound();

  const storedFlow = guestFlowFromStoredKind(session.interaction_kind);
  if (flow && storedFlow !== flow) {
    const path = flowSessionPath("tap", storedFlow);
    const sp = new URLSearchParams();
    for (const [key, value] of Object.entries(query)) {
      if (typeof value === "string") sp.set(key, value);
      else if (Array.isArray(value)) for (const item of value) sp.append(key, item);
    }
    const qs = sp.toString();
    redirect(`${path}/${token}${qs ? `?${qs}` : ""}`);
  }
  if (!flow) table = storedFlow === "calibrate" ? CALIBRATE_SESSIONS_TABLE : VERIFY_SESSIONS_TABLE;

  if (session.status === "revoked") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <p className="text-sm text-red-400">This session link has been revoked</p>
      </div>
    );
  }

  if (session.assigned_user_id) {
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (!user) {
      const sessionPath = `${flowSessionPath("tap", String(session.interaction_kind || ""))}/${token}`;
      redirect(`/login?redirect=${encodeURIComponent(sessionPath)}`);
    }
    if (user.id !== session.assigned_user_id) {
      notFound();
    }
  }

  const entryParams = collectEntryQueryParams(query);
  if (Object.keys(entryParams).length > 0 && typeof session.id === "string") {
    await recordGuestLinkEntryQueryParams(
      supabase,
      table,
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

  const shell = resolveTapShellFromSession({
    interaction_kind: session.interaction_kind,
    session_shell: session.session_shell,
    entry_query_params: session.entry_query_params,
    initialSession: {
      interaction_kind: session.interaction_kind,
      session_shell: session.session_shell,
    },
  });
  const clientProps = {
    workspaceId: String(session.workspace_id),
    privateToken: token,
    sessionId: (session.session_id as string) || undefined,
    blockId: (session.block_id as string) || undefined,
    initialSession,
    showEndSession,
    entryQueryParams: entryParams,
    participantIdentity,
  };

  if (shell === "scout") {
    return <ScoutTapClient {...clientProps} />;
  }

  return <TapScoreClient {...clientProps} sidebarMode="verification-tap" />;
}
