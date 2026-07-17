"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

interface InviteDetails {
  id: string;
  token: string;
  is_used: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
  } | null;
}

export default function InvitePage() {
  const router = useRouter();
  const params = useParams();
  const token = params.token as string;
  const supabase = createClient();
  const { t } = useI18n();
  
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [invite, setInvite] = useState<InviteDetails | null>(null);
  const [user, setUser] = useState<{ id: string; email?: string } | null>(null);
  const [userOrg, setUserOrg] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    loadInviteAndUser();
  }, [token]);

  const loadInviteAndUser = async () => {
    try {
      // Load invite details
      const inviteRes = await fetch(`/api/invite/accept?token=${token}`);
      const inviteData = await inviteRes.json();
      
      if (!inviteRes.ok) {
        setError(inviteData.error || "Invalid invite link");
        setLoading(false);
        return;
      }
      
      setInvite(inviteData.invite);

      // Check if user is logged in
      const { data: { user: authUser } } = await supabase.auth.getUser();
      
      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email || undefined });
        
        // Check if user already has an organization
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", authUser.id)
          .single();
        
        if (profile?.organization_id) {
          setUserOrg(profile.organization_id);
        }
      }
    } catch (err) {
      console.error("Load invite error:", err);
      setError("Failed to load invite details");
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!user) {
      // Redirect to login with return URL
      router.push(`/login?returnUrl=/invite/${token}`);
      return;
    }

    setAccepting(true);
    try {
      const res = await fetch("/api/invite/accept", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || "Failed to accept invite");
      } else {
        setSuccess(true);
      }
    } catch (err) {
      console.error("Accept invite error:", err);
      setError("Failed to accept invite");
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <LoadingStatusMessage message={t('common.loading')} />
      </div>
    );
  }

  // Success state
  if (success && invite?.organization) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-green-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('invite.welcomeTo', { org: invite.organization.name })}</h1>
          <p className="text-neutral-400 mb-6">
            {t('invite.successfullyJoined')}
          </p>
          <Link
            href="/dashboard"
            className="inline-block px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
          >
            {t('invite.goToDashboard')}
          </Link>
        </div>
      </div>
    );
  }

  // Error states
  if (error || !invite) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('invite.invalidInvite')}</h1>
          <p className="text-neutral-400 mb-6">
            {error || t('invite.invalidOrExpired')}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
          >
            {t('invite.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  // Invite already used
  if (invite.is_used) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('invite.alreadyUsed')}</h1>
          <p className="text-neutral-400 mb-6">
            {t('invite.alreadyUsedDesc')}
          </p>
          <Link
            href="/"
            className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
          >
            {t('invite.goHome')}
          </Link>
        </div>
      </div>
    );
  }

  // User already in an organization
  if (user && userOrg) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
          <div className="w-16 h-16 bg-yellow-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">{t('invite.alreadyInOrg')}</h1>
          <p className="text-neutral-400 mb-6">
            {t('invite.alreadyInOrgDesc')}
          </p>
          <div className="flex gap-3 justify-center">
            <Link
              href="/organization"
              className="px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
            >
              {t('invite.manageOrganization')}
            </Link>
            <Link
              href="/dashboard"
              className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition-colors"
            >
              {t('invite.goToDashboard')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  // Main invite acceptance view
  return (
    <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-neutral-900/50 border border-neutral-800 rounded-lg p-8">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-blue-500/20 rounded-full flex items-center justify-center mx-auto mb-6">
            <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">
            {t('invite.joinOrg', { org: invite.organization?.name || t('invite.organizationFallback') })}
          </h1>
          <p className="text-neutral-400">
            {t('invite.invitedToJoin')}
          </p>
        </div>

        {invite.organization && (
          <div className="bg-neutral-800/50 rounded-lg p-4 mb-6">
            <div className="text-sm text-neutral-400 mb-1">{t('invite.organizationLabel')}</div>
            <div className="text-lg text-white font-medium">{invite.organization.name}</div>
            <code className="text-xs text-neutral-500">{invite.organization.slug}</code>
          </div>
        )}

        {user ? (
          <div className="space-y-4">
            <div className="bg-neutral-800/50 rounded-lg p-4">
              <div className="text-sm text-neutral-400 mb-1">{t('invite.joiningAs')}</div>
              <div className="text-white">{user.email}</div>
            </div>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors"
            >
              {accepting ? t('invite.joining') : t('invite.acceptInvite')}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-neutral-400 text-sm text-center">
              {t('invite.loginToAccept')}
            </p>
            <div className="flex gap-3">
              <Link
                href={`/login?returnUrl=/invite/${token}`}
                className="flex-1 py-3 bg-neutral-800 hover:bg-neutral-700 text-white text-center font-medium rounded-lg transition-colors"
              >
                {t('invite.logIn')}
              </Link>
              <Link
                href={`/register?returnUrl=/invite/${token}`}
                className="flex-1 py-3 bg-blue-600 hover:bg-blue-700 text-white text-center font-medium rounded-lg transition-colors"
              >
                {t('invite.signUp')}
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
