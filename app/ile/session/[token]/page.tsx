import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  ensureIleLinkSession,
  resolveIleLinkAccess,
} from "@/lib/ile-link-auth";
import { IleGuestSessionClient } from "@/components/IleGuestSessionClient";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function PrivateIleSessionPage({ params }: PageProps) {
  const { token } = await params;
  const access = await resolveIleLinkAccess(token);
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

  const ensured = await ensureIleLinkSession(access);
  if ("error" in ensured) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a] px-4">
        <p className="text-sm text-red-400">{ensured.error}</p>
      </div>
    );
  }

  return (
    <IleGuestSessionClient
      sessionId={ensured.sessionId}
      ileToken={token}
      blockTitle={ensured.blockTitle}
    />
  );
}
