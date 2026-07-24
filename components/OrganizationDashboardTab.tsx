"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  fileToLogoPayload,
  validateLogoFile,
} from "@/lib/organization/logo-client";

const cardClass =
  "rounded-md border border-neutral-800 bg-neutral-950/75 backdrop-blur-sm";
const cardPaddedClass = `${cardClass} p-5 sm:p-6`;
const labelClass =
  "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const primaryBtnClass =
  "inline-flex h-10 items-center justify-center rounded-sm bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtnClass =
  "inline-flex h-10 items-center justify-center rounded-sm border border-neutral-700 bg-neutral-950/60 px-4 text-sm text-neutral-200 transition hover:border-neutral-500 hover:text-white disabled:cursor-not-allowed disabled:opacity-50";
const dangerBtnClass =
  "inline-flex h-8 items-center justify-center rounded-sm border border-neutral-700 bg-neutral-950/60 px-3 text-xs text-neutral-300 transition hover:bg-neutral-900 disabled:opacity-50";
const inputClass =
  "w-full rounded-md border border-neutral-800 bg-neutral-950/60 px-4 py-2 text-sm text-white placeholder-neutral-500 focus:border-neutral-600 focus:outline-none";

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

/** Organization management panel for the Dashboard Organization tab. */
export function OrganizationDashboardTab() {
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
  const [linkCopiedId, setLinkCopiedId] = useState<string | null>(null);

  useEffect(() => {
    void loadOrganization();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadOrganization = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.push("/login");
        return;
      }

      setCurrentUserId(user.id);

      const res = await fetch("/api/organization");
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || t("organization.loadError"));
        setLoading(false);
        return;
      }

      setOrganization(data.organization);
      setIsOrgAdmin(data.is_org_admin);
      setMembers(data.members || []);
      setInvites(data.invites || []);
    } catch (err) {
      console.error("Load organization error:", err);
      setError(t("organization.loadError"));
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
        alert(data.error || t("organization.generateError"));
      } else {
        setShowInviteModal(false);
        setInviteCount(1);
        void loadOrganization();
      }
    } catch (err) {
      console.error("Generate invites error:", err);
      alert(t("organization.generateError"));
    } finally {
      setGeneratingInvites(false);
    }
  };

  const handleDeleteInvite = async (inviteId: string) => {
    if (!confirm(t("organization.revokeConfirm"))) return;

    try {
      const res = await fetch("/api/organization/invites", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ inviteId }),
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || t("organization.revokeError"));
      } else {
        void loadOrganization();
      }
    } catch (err) {
      console.error("Delete invite error:", err);
      alert(t("organization.revokeError"));
    }
  };

  const handleRemoveMember = async (memberId: string, memberName: string) => {
    const isSelf = memberId === currentUserId;
    const message = isSelf
      ? t("organization.leaveConfirm")
      : t("organization.removeMemberConfirm", { memberName });

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
        alert(data.error || t("organization.removeMemberError"));
      } else {
        if (isSelf) {
          router.refresh();
          void loadOrganization();
        } else {
          void loadOrganization();
        }
      }
    } catch (err) {
      console.error("Remove member error:", err);
      alert(t("organization.removeMemberError"));
    } finally {
      setRemovingMember(null);
    }
  };

  const copyInviteLink = async (inviteId: string, token: string) => {
    const url = `${window.location.origin}/invite/${token}`;
    try {
      await navigator.clipboard.writeText(url);
      setLinkCopiedId(inviteId);
      setTimeout(() => setLinkCopiedId(null), 2000);
    } catch {
      alert(t("organization.inviteCopied"));
    }
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

  const planLabel = (plan: string) => {
    if (plan === "api_metered") return "API Metered";
    if (plan === "trial") return "Trial";
    if (plan === "inactive") return "Inactive";
    return plan;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <LoadingStatusMessage message={t("common.loading")} />
      </div>
    );
  }

  if (error) {
    return (
      <div className={`${cardPaddedClass} text-sm text-neutral-300`}>{error}</div>
    );
  }

  if (!organization) {
    return (
      <div className={`${cardPaddedClass} text-center`}>
        <p className={labelClass}>Organization</p>
        <h2 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">
          {t("organization.noOrganization")}
        </h2>
        <p className="mx-auto mt-3 max-w-md text-sm text-neutral-400">
          {t("organization.noOrganizationDesc")}
        </p>
      </div>
    );
  }

  const unusedInvites = invites.filter((i) => !i.used_by);
  const usedInvites = invites.filter((i) => i.used_by);

  return (
    <div className="space-y-6">
      {/* Header card */}
      <section className={cardPaddedClass}>
        <div className="flex min-w-0 items-start gap-4">
          <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-md border border-neutral-700 bg-neutral-900/80">
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
          <div className="min-w-0">
            <p className={labelClass}>Organization</p>
            <h2 className="mt-1 text-2xl font-medium tracking-[-0.5px] text-white sm:text-3xl">
              {organization.name}
            </h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <code className="rounded border border-neutral-800 bg-black/40 px-2 py-0.5 font-mono text-xs text-neutral-400">
                {organization.slug}
              </code>
              {isOrgAdmin ? (
                <span className="rounded-full border border-white/15 bg-white/[0.06] px-2.5 py-0.5 text-[10px] uppercase tracking-[1.4px] text-white">
                  {t("organization.orgAdmin")}
                </span>
              ) : (
                <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-0.5 text-[10px] uppercase tracking-[1.4px] text-neutral-400">
                  {t("organization.member")}
                </span>
              )}
            </div>
            {isOrgAdmin && (
              <div className="mt-4">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-neutral-700 bg-neutral-950/60 px-3 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500 hover:text-white">
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
                <p className="mt-1.5 text-xs text-neutral-500">
                  {t("organization.logoHelper")}
                </p>
              </div>
            )}
          </div>
        </div>
      </section>

      {isOrgAdmin && (
        <section className="grid gap-4 sm:grid-cols-3">
          <div className={cardPaddedClass}>
            <p className={labelClass}>{t("organization.members")}</p>
            <p className="mt-3 text-3xl font-medium tracking-[-1px] text-white">
              {members.length}
            </p>
          </div>
          <div className={cardPaddedClass}>
            <p className={labelClass}>{t("organization.admins")}</p>
            <p className="mt-3 text-3xl font-medium tracking-[-1px] text-white">
              {members.filter((m) => m.is_org_admin).length}
            </p>
          </div>
          <div className={cardPaddedClass}>
            <p className={labelClass}>{t("organization.pendingInvites")}</p>
            <p className="mt-3 text-3xl font-medium tracking-[-1px] text-white">
              {unusedInvites.length}
            </p>
          </div>
        </section>
      )}

      {isOrgAdmin && (
        <section className={`${cardClass} overflow-hidden`}>
          <div className="border-b border-neutral-800 px-5 py-4 sm:px-6">
            <p className={labelClass}>{t("organization.members")}</p>
            <h3 className="mt-1 text-sm font-medium text-white">
              People in this organization
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px]">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="px-5 py-3 text-left font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500 sm:px-6">
                    {t("organization.user")}
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                    {t("organization.plan")}
                  </th>
                  <th className="px-4 py-3 text-left font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                    {t("organization.role")}
                  </th>
                  <th className="px-5 py-3 text-right font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500 sm:px-6">
                    {t("organization.actions")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {members.map((member) => (
                  <tr
                    key={member.id}
                    className="border-b border-neutral-800/50 last:border-0 hover:bg-white/[0.02]"
                  >
                    <td className="px-5 py-3.5 sm:px-6">
                      <div className="text-sm text-neutral-200">
                        {member.username || member.email || t("organization.unknown")}
                      </div>
                      <div className="text-xs text-neutral-500">{member.email}</div>
                      {member.id === currentUserId && (
                        <span className="text-xs text-neutral-400">
                          {t("organization.you")}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3.5 text-sm text-neutral-400">
                      {planLabel(member.plan)}
                    </td>
                    <td className="px-4 py-3.5">
                      {member.is_org_admin ? (
                        <span className="rounded-full border border-white/15 bg-white/[0.06] px-2 py-0.5 text-[10px] uppercase tracking-[1.2px] text-white">
                          {t("organization.admin")}
                        </span>
                      ) : (
                        <span className="text-sm text-neutral-500">
                          {t("organization.member")}
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5 text-right sm:px-6">
                      <button
                        onClick={() =>
                          handleRemoveMember(
                            member.id,
                            member.username || member.email || "this user"
                          )
                        }
                        disabled={removingMember === member.id}
                        className={dangerBtnClass}
                      >
                        {member.id === currentUserId
                          ? t("organization.leave")
                          : t("organization.remove")}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {isOrgAdmin && (
        <section className={`${cardClass} overflow-hidden`}>
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-neutral-800 px-5 py-4 sm:px-6">
            <div>
              <p className={labelClass}>{t("organization.inviteLinks")}</p>
              <h3 className="mt-1 text-sm font-medium text-white">
                Share single-use links to add members
              </h3>
            </div>
            <button
              onClick={() => setShowInviteModal(true)}
              className={primaryBtnClass}
            >
              {t("organization.generateInvites")}
            </button>
          </div>

          {invites.length === 0 ? (
            <div className="px-5 py-10 text-center text-sm text-neutral-500 sm:px-6">
              {t("organization.noInvitesYet")}
            </div>
          ) : (
            <div className="divide-y divide-neutral-800/60">
              {unusedInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <code className="break-all rounded border border-white/15 bg-white/[0.06] px-2 py-1 font-mono text-xs text-white">
                      {invite.token}
                    </code>
                    <p className="mt-1.5 text-xs text-neutral-500">
                      {t("organization.created", {
                        date: formatDate(invite.created_at),
                      })}
                    </p>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    <button
                      onClick={() => copyInviteLink(invite.id, invite.token)}
                      className={secondaryBtnClass}
                    >
                      {linkCopiedId === invite.id
                        ? t("common.copied")
                        : t("organization.copyLink")}
                    </button>
                    <button
                      onClick={() => handleDeleteInvite(invite.id)}
                      className={dangerBtnClass}
                    >
                      {t("organization.revoke")}
                    </button>
                  </div>
                </div>
              ))}

              {usedInvites.map((invite) => (
                <div
                  key={invite.id}
                  className="flex flex-col gap-2 px-5 py-4 opacity-55 sm:flex-row sm:items-center sm:justify-between sm:px-6"
                >
                  <div className="min-w-0">
                    <code className="break-all rounded border border-neutral-800 bg-black/40 px-2 py-1 font-mono text-xs text-neutral-500 line-through">
                      {invite.token}
                    </code>
                    <p className="mt-1.5 text-xs text-neutral-600">
                      {t("organization.usedOn", {
                        date: formatDate(invite.used_at),
                      })}
                    </p>
                  </div>
                  <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] uppercase tracking-[1.4px] text-neutral-500">
                    {t("organization.used")}
                  </span>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {!isOrgAdmin && (
        <section className={cardPaddedClass}>
          <p className={labelClass}>Membership</p>
          <p className="mt-2 max-w-xl text-sm leading-relaxed text-neutral-400">
            {t("organization.leaveOrgMessage")}
          </p>
          <button
            onClick={() => handleRemoveMember(currentUserId!, "yourself")}
            disabled={removingMember === currentUserId}
            className={`${dangerBtnClass} mt-5 h-10 px-4 text-sm`}
          >
            {t("organization.leaveOrganization")}
          </button>
        </section>
      )}

      {showInviteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-sm">
          <div className={`${cardClass} w-full max-w-md p-6`}>
            <p className={labelClass}>Invites</p>
            <h3 className="mt-1 text-xl font-medium tracking-[-0.5px] text-white">
              {t("organization.generateInviteModal")}
            </h3>
            <div className="mt-6">
              <label className="mb-2 block text-sm text-neutral-400">
                {t("organization.numberOfInvites")}
              </label>
              <input
                type="number"
                min={1}
                max={50}
                value={inviteCount}
                onChange={(e) =>
                  setInviteCount(
                    Math.min(50, Math.max(1, parseInt(e.target.value, 10) || 1))
                  )
                }
                className={inputClass}
              />
              <p className="mt-1.5 text-xs text-neutral-500">
                {t("organization.inviteHelper")}
              </p>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => {
                  setShowInviteModal(false);
                  setInviteCount(1);
                }}
                className={`${secondaryBtnClass} flex-1`}
              >
                {t("common.cancel")}
              </button>
              <button
                onClick={handleGenerateInvites}
                disabled={generatingInvites}
                className={`${primaryBtnClass} flex-1`}
              >
                {generatingInvites
                  ? t("organization.generating")
                  : t("organization.generate")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
