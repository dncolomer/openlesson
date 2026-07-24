import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ensureIleLinkSession,
  resolveIleLinkAccess,
} from "@/lib/ile-link-auth";
import { IleGuestSessionClient } from "@/components/IleGuestSessionClient";
import {
  collectEntryQueryParams,
  recordGuestLinkEntryQueryParams,
} from "@/lib/guest-link-access";
import { buildPowParticipantIdentity } from "@/lib/session-participant-identity";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PrivateIleSessionPage({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const entryParams = collectEntryQueryParams(query);
  const access = await resolveIleLinkAccess(token, entryParams);
  if ("error" in access) notFound();

  if (access.assignedUserId) {
    const authSupabase = await createClient();
    const {
      data: { user },
    } = await authSupabase.auth.getUser();
    if (!user) {
      redirect(`/login?redirect=${encodeURIComponent(`/ile/session/${token}`)}`);
    }
    if (user.id !== access.assignedUserId) {
      notFound();
    }
  }

  if (Object.keys(entryParams).length > 0) {
    await recordGuestLinkEntryQueryParams(
      access.supabase,
      "workspace_ile_links",
      access.linkId,
      entryParams,
    ).catch(() => {});
  }

  const ensured = await ensureIleLinkSession(access);
  if ("error" in ensured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <p className="text-sm text-red-400">{ensured.error}</p>
      </div>
    );
  }

  const participantIdentity = buildPowParticipantIdentity({
    guestUserId: access.guestUserId,
    assignedUserId: access.assignedUserId,
  });

  return (
    <IleGuestSessionClient
      sessionId={ensured.sessionId}
      ileToken={token}
      blockTitle={ensured.blockTitle}
      showEndSession={access.showEndSession}
      entryQueryParams={entryParams}
      participantIdentity={participantIdentity}
    />
  );
}
