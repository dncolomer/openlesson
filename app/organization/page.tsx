"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { Navbar } from "@/components/Navbar";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  fileToLogoPayload,
  validateLogoFile,
} from "@/lib/organization/logo-client";

interface Organization {
  id: string;
  name: string;
  slug: string;
  logo_url?: string | null;
  created_at: string;
}

interface Member {
  id: string;
  username: string | null;
  email: string | null;
  is_org_admin: boolean;
  created_at: string;
  plan: string;
  subscription_status: string;
}

interface Invite {
  id: string;
  token: string;
  used_by: string | null;
  used_at: string | null;
  created_at: string;
}

export default function OrganizationPage() {
  const { t } = useI18n();
  const router = useRouter();
  const supabase = createClient();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [isOrgAdmin, setIsOrgAdmin] = useState(false);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  
  const [generatingInvites, setGeneratingInvites] = useState(false);
  const [inviteCount, setInviteCount] = useState(1);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [removingMember, setRemovingMember] = useState<string | null>(null);
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    loadOrganization();
  }, []);

  const loadOrganization = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        router.push("/login");
        return;
      }
      
      setCurrentUserId(user.id);

      const res = await fetch("/api/organization");
      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || t('organization.loadError'));
        setLoading(false);
        return;
      }

      setOrganization(data.organization);
      setIsOrgAdmin(data.is_org_admin);
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (err) {
      console.error("Load organization error:", err);
      setError(t('organization.loadError'));
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateInvites = async () => {
    setGeneratingInvites(true);
    try {
      const res = await fetch("/api/organization/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ count: inviteCount }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || t('organization.generateError'));
      } else {
        setShowInviteModal(false);
        setInviteCount(1);
        loadOrganization();
      }
    } catch (err) {
      console.error("Generate invites error:", err);
      alert(t('organization.generateError'));
    } finally {
      setGeneratingInvites(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm(t('organization.revokeConfirm'))) return;
    
    try {
      const res = await fetch("/api/organization/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });
      
      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t('organization.revokeError'));
      } else {
        loadOrganization();
      }
    } catch (err) {
      console.error("Delete invite error:", err);
      alert(t('organization.revokeError'));
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const isSelf = memberId === currentUserId;
    const message = isSelf 
      ? t('organization.leaveConfirm')
      : t('organization.removeMemberConfirm', { memberName });
    
    if (!confirm(message)) return;
    
    setRemovingMember(memberId);
    try {
      const res = await fetch("/api/organization/members", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ memberId }),
      });
      
      const data = await res.json();
      
      if (!res.ok) {
        alert(data.error || t('organization.removeMemberError'));
      } else {
        if (isSelf) {
          // User left the org, refresh the page
          router.refresh();
          loadOrganization();
        } else {
          loadOrganization();
        }
      }
    } catch (err) {
      console.error("Remove member error:", err);
      alert(t('organization.removeMemberError'));
    } finally {
      setRemovingMember(null);
    }
  };

  const copyInviteLink = (token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    navigator.clipboard.writeText(url);
    alert(t('organization.inviteCopied'));
  };

  const handleLogoUpload = async (file: File | null) => {
    if (!file) return;
    const err = validateLogoFile(file);
    if (err) {
      alert(err);
      return;
    }
    setUploadingLogo(true);
    try {
      const logo = await fileToLogoPayload(file);
      const res = await fetch("/api/organization/logo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ logo }),
      });
      const data = await res.json();
      if (!res.ok) {
        alert(data.error || t("organization.logoUploadError"));
      } else if (organization) {
        setOrganization({ ...organization, logo_url: data.logo_url });
      }
    } catch (uploadErr) {
      console.error("Logo upload error:", uploadErr);
      alert(t("organization.logoUploadError"));
    } finally {
      setUploadingLogo(false);
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const getPlanColor = (plan: string) => {
    switch (plan) {
      case "pro": return "text-purple-400";
      case "regular": return "text-blue-400";
      default: return "text-neutral-400";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="flex items-center justify-center py-24">
          <LoadingStatusMessage message={t('common.loading')} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="max-w-5xl mx-auto p-6">
          <div className="text-red-400">{error}</div>
        </div>
      </div>
    );
  }

  // No organization
  if (!organization) {
    return (
      <div className="min-h-screen bg-[#0a0a0a]">
        <Navbar />
        <div className="max-w-5xl mx-auto p-6">
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-8 text-center">
            <div className="w-16 h-16 bg-neutral-800 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-neutral-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            </div>
            <h1 className="text-2xl font-bold text-white mb-2">{t('organization.noOrganization')}</h1>
            <p className="text-neutral-400 mb-6">
              {t('organization.noOrganizationDesc')}
            </p>
            <Link
              href="/dashboard"
              className="inline-block px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
            >
              {t('organization.goToDashboard')}
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const unusedInvites = invites.filter(i => !i.used_by);
  const usedInvites = invites.filter(i => i.used_by);

  return (
    <div className="min-h-screen bg-[#0a0a0a]">
      <Navbar />
      <div className="max-w-5xl mx-auto p-6">
        {/* Header */}
        <div className="mb-6">
          <Link href="/dashboard" className="text-neutral-400 hover:text-white text-sm">
            &larr; {t('organization.backToDashboard')}
          </Link>
          <div className="mt-3 flex items-start gap-4">
            <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-neutral-900">
              {organization.logo_url ? (
                <Image
                  src={organization.logo_url}
                  alt={`${organization.name} logo`}
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : (
                <span className="text-xl font-medium text-neutral-500">
                  {organization.name.charAt(0).toUpperCase()}
                </span>
              )}
            </div>
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold text-white">{organization.name}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <code className="text-sm text-neutral-400 bg-neutral-800 px-2 py-1 rounded">
                  {organization.slug}
                </code>
                {isOrgAdmin && (
                  <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    {t('organization.orgAdmin')}
                  </span>
                )}
              </div>
              {isOrgAdmin && (
                <div className="mt-3">
                  <label className="inline-flex cursor-pointer items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-3 py-1.5 text-xs text-neutral-300 hover:border-neutral-600 hover:text-white">
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/gif,image/svg+xml"
                      className="hidden"
                      disabled={uploadingLogo}
                      onChange={(e) => {
                        void handleLogoUpload(e.target.files?.[0] ?? null);
                        e.target.value = "";
                      }}
                    />
                    {uploadingLogo
                      ? t("organization.uploadingLogo")
                      : organization.logo_url
                        ? t("organization.changeLogo")
                        : t("organization.uploadLogo")}
                  </label>
                  <p className="mt-1 text-xs text-neutral-500">{t("organization.logoHelper")}</p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stats (for org admins) */}
        {isOrgAdmin && (
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">{members.length}</div>
              <div className="text-neutral-400 text-sm">{t('organization.members')}</div>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-white">
                {members.filter(m => m.is_org_admin).length}
              </div>
              <div className="text-neutral-400 text-sm">{t('organization.admins')}</div>
            </div>
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-4">
              <div className="text-2xl font-bold text-yellow-400">{unusedInvites.length}</div>
              <div className="text-neutral-400 text-sm">{t('organization.pendingInvites')}</div>
            </div>
          </div>
        )}

        {/* Members (for org admins) */}
        {isOrgAdmin && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg mb-6">
            <div className="p-4 border-b border-neutral-800">
              <h2 className="text-lg font-semibold text-white">{t('organization.members')}</h2>
            </div>
            <table className="w-full">
              <thead>
                <tr className="border-b border-neutral-800">
                   <th className="text-left p-4 text-neutral-400 text-sm font-medium">{t('organization.user')}</th>
                   <th className="text-left p-4 text-neutral-400 text-sm font-medium">{t('organization.plan')}</th>
                   <th className="text-left p-4 text-neutral-400 text-sm font-medium">{t('organization.role')}</th>
                   <th className="text-right p-4 text-neutral-400 text-sm font-medium">{t('organization.actions')}</th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr key={member.id} className="border-b border-neutral-800/50 hover:bg-neutral-800/20">
                    <td className="p-4">
                      <div className="text-neutral-200">{member.username || member.email || t('organization.unknown')}</div>
                      <div className="text-xs text-neutral-500">{member.email}</div>
                      {member.id === currentUserId && (
                        <span className="text-xs text-blue-400">{t('organization.you')}</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className={getPlanColor(member.plan)}>{member.plan}</span>
                    </td>
                    <td className="p-4">
                      {member.is_org_admin ? (
                        <span className="px-2 py-1 text-xs rounded bg-purple-500/20 text-purple-400 border border-purple-500/30">
                          {t('organization.admin')}
                        </span>
                      ) : (
                        <span className="text-neutral-500 text-sm">{t('organization.member')}</span>
                      )}
                    </td>
                    <td className="p-4 text-right">
                      <button
                        onClick={() => handleRemoveMember(member.id, member.username || member.email || "this user")}
                        disabled={removingMember === member.id}
                        className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors disabled:opacity-50"
                      >
                        {member.id === currentUserId ? t('organization.leave') : t('organization.remove')}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Invites (for org admins) */}
        {isOrgAdmin && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg">
            <div className="p-4 border-b border-neutral-800 flex items-center justify-between">
              <h2 className="text-lg font-semibold text-white">{t('organization.inviteLinks')}</h2>
              <button
                onClick={() => setShowInviteModal(true)}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm rounded-lg transition-colors"
              >
                {t('organization.generateInvites')}
              </button>
            </div>
            
            {invites.length === 0 ? (
              <div className="p-8 text-center text-neutral-400">
                {t('organization.noInvitesYet')}
              </div>
            ) : (
              <div className="divide-y divide-neutral-800/50">
                {/* Unused invites first */}
                {unusedInvites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between hover:bg-neutral-800/20">
                    <div>
                      <code className="text-sm text-green-400 bg-green-900/20 px-2 py-1 rounded">
                        {invite.token}
                      </code>
                      <div className="text-xs text-neutral-500 mt-1">
                        {t('organization.created', { date: formatDate(invite.created_at) })}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => copyInviteLink(invite.token)}
                        className="px-3 py-1 text-xs bg-neutral-800 hover:bg-neutral-700 text-white rounded transition-colors"
                      >
                        {t('organization.copyLink')}
                      </button>
                      <button
                        onClick={() => handleDeleteInvite(invite.id)}
                        className="px-3 py-1 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded transition-colors"
                      >
                        {t('organization.revoke')}
                      </button>
                    </div>
                  </div>
                ))}
                
                {/* Used invites */}
                {usedInvites.map((invite) => (
                  <div key={invite.id} className="p-4 flex items-center justify-between opacity-60">
                    <div>
                      <code className="text-sm text-neutral-500 bg-neutral-800 px-2 py-1 rounded line-through">
                        {invite.token}
                      </code>
                      <div className="text-xs text-neutral-500 mt-1">
                        {t('organization.usedOn', { date: formatDate(invite.used_at) })}
                      </div>
                    </div>
                    <span className="px-2 py-1 text-xs bg-neutral-800 text-neutral-500 rounded">
                      {t('organization.used')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Non-admin view */}
        {!isOrgAdmin && (
          <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
            <p className="text-neutral-400 mb-4">
              {t('organization.leaveOrgMessage')}
            </p>
            <button
              onClick={() => handleRemoveMember(currentUserId!, "yourself")}
              disabled={removingMember === currentUserId}
              className="px-4 py-2 bg-red-600/20 hover:bg-red-600/30 text-red-400 rounded-lg transition-colors disabled:opacity-50"
            >
              {t('organization.leaveOrganization')}
            </button>
          </div>
        )}

        {/* Generate Invites Modal */}
        {showInviteModal && (
          <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
            <div className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 max-w-md w-full mx-4">
              <h2 className="text-xl font-bold text-white mb-4">{t('organization.generateInviteModal')}</h2>
              <div className="mb-6">
                <label className="block text-sm text-neutral-400 mb-2">{t('organization.numberOfInvites')}</label>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={inviteCount}
                  onChange={(e) => setInviteCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
                  className="w-full px-4 py-2 bg-neutral-800 border border-neutral-700 rounded-lg text-white focus:outline-none focus:border-neutral-600"
                />
                <p className="text-xs text-neutral-500 mt-1">{t('organization.inviteHelper')}</p>
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowInviteModal(false);
                    setInviteCount(1);
                  }}
                  className="flex-1 px-4 py-2 bg-neutral-800 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  {t('common.cancel')}
                </button>
                <button
                  onClick={handleGenerateInvites}
                  disabled={generatingInvites}
                  className="flex-1 px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-lg transition-colors"
                >
                  {generatingInvites ? t('organization.generating') : t('organization.generate')}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
