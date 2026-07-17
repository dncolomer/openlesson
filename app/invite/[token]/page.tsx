"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { useI18n } from "@/lib/i18n";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { BrandLogo } from "@/components/BrandLogo";

const INVITE_BACKGROUND = "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg";

const shellStyle = {
  backgroundImage: `linear-gradient(rgba(10,10,10,0.82), rgba(10,10,10,0.82)), url(${INVITE_BACKGROUND})`,
} as const;

const cardClass =
  "w-full max-w-md rounded-md border border-neutral-800 bg-neutral-950/75 p-6 sm:p-8 backdrop-blur-sm";
const labelClass = "font-mono text-[10px] uppercase tracking-[2px] text-neutral-500";
const primaryBtnClass =
  "inline-flex w-full items-center justify-center rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-50";
const secondaryBtnClass =
  "inline-flex w-full items-center justify-center rounded-sm border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm font-medium text-neutral-200 transition hover:border-neutral-600 hover:bg-neutral-800 hover:text-white";

interface InviteDetails {
  id: string;
  token: string;
  is_used: boolean;
  organization: {
    id: string;
    name: string;
    slug: string;
    logo_url?: string | null;
  } | null;
}

function InviteShell({ children }: { children: ReactNode }) {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={shellStyle}
    >
      <div className="flex min-h-screen flex-col">
        <header className="border-b border-neutral-800/60 px-5 py-4">
          <Link href="/" className="inline-flex opacity-90 transition hover:opacity-100">
            <BrandLogo size={28} nameClassName="text-sm font-semibold tracking-tight text-white" />
          </Link>
        </header>
        <main className="flex flex-1 items-center justify-center p-4 sm:p-6">{children}</main>
      </div>
    </div>
  );
}

function OrgMark({
  name,
  logoUrl,
  size = 64,
}: {
  name: string;
  logoUrl?: string | null;
  size?: number;
}) {
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={`${name} logo`}
        width={size}
        height={size}
        className="rounded-md border border-neutral-700 object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }

  return (
    <div
      className="flex items-center justify-center rounded-md border border-neutral-700 bg-neutral-900/80 font-medium text-neutral-300"
      style={{ width: size, height: size, fontSize: size * 0.35 }}
    >
      {name.charAt(0).toUpperCase() || "?"}
    </div>
  );
}

function StatusIcon({ tone }: { tone: "success" | "error" | "warning" }) {
  const tones = {
    success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
    error: "border-red-500/30 bg-red-500/10 text-red-400",
    warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  };
  const paths = {
    success: "M5 13l4 4L19 7",
    error: "M6 18L18 6M6 6l12 12",
    warning:
      "M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z",
  };
  return (
    <div
      className={`mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full border ${tones[tone]}`}
    >
      <svg className="h-7 w-7" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={paths[tone]} />
      </svg>
    </div>
  );
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  const loadInviteAndUser = async () => {
    try {
      const inviteRes = await fetch(`/api/invite/accept?token=${token}`);
      const inviteData = await inviteRes.json();

      if (!inviteRes.ok) {
        setError(inviteData.error || "Invalid invite link");
        setLoading(false);
        return;
      }

      setInvite(inviteData.invite);

      const {
        data: { user: authUser },
      } = await supabase.auth.getUser();

      if (authUser) {
        setUser({ id: authUser.id, email: authUser.email || undefined });

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
      router.push(`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`);
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
      <div
        className="flex min-h-screen items-center justify-center bg-[#0a0a0a] bg-cover bg-center"
        style={shellStyle}
      >
        <LoadingStatusMessage message={t("common.loading")} />
      </div>
    );
  }

  if (success && invite?.organization) {
    return (
      <InviteShell>
        <div className={`${cardClass} text-center`}>
          <div className="relative mx-auto mb-6 inline-flex">
            <OrgMark
              name={invite.organization.name}
              logoUrl={invite.organization.logo_url}
              size={72}
            />
            <span className="absolute -bottom-1 -right-1 flex h-6 w-6 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/20 text-emerald-400">
              <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </span>
          </div>
          <p className={labelClass}>{t("invite.organizationLabel")}</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white sm:text-3xl">
            {t("invite.welcomeTo", { org: invite.organization.name })}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            {t("invite.successfullyJoined")}
          </p>
          <Link href="/dashboard" className={`${primaryBtnClass} mt-8`}>
            {t("invite.goToDashboard")}
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (error || !invite) {
    return (
      <InviteShell>
        <div className={`${cardClass} text-center`}>
          <StatusIcon tone="error" />
          <p className={labelClass}>Invite</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">
            {t("invite.invalidInvite")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            {error || t("invite.invalidOrExpired")}
          </p>
          <Link href="/" className={`${secondaryBtnClass} mt-8`}>
            {t("invite.goHome")}
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (invite.is_used) {
    return (
      <InviteShell>
        <div className={`${cardClass} text-center`}>
          {invite.organization && (
            <div className="mb-6 flex justify-center">
              <OrgMark
                name={invite.organization.name}
                logoUrl={invite.organization.logo_url}
                size={64}
              />
            </div>
          )}
          <StatusIcon tone="warning" />
          <p className={labelClass}>Invite</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">
            {t("invite.alreadyUsed")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            {t("invite.alreadyUsedDesc")}
          </p>
          <Link href="/" className={`${secondaryBtnClass} mt-8`}>
            {t("invite.goHome")}
          </Link>
        </div>
      </InviteShell>
    );
  }

  if (user && userOrg) {
    return (
      <InviteShell>
        <div className={`${cardClass} text-center`}>
          {invite.organization && (
            <div className="mb-6 flex justify-center">
              <OrgMark
                name={invite.organization.name}
                logoUrl={invite.organization.logo_url}
                size={64}
              />
            </div>
          )}
          <StatusIcon tone="warning" />
          <p className={labelClass}>Invite</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white">
            {t("invite.alreadyInOrg")}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            {t("invite.alreadyInOrgDesc")}
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link href="/organization" className={secondaryBtnClass}>
              {t("invite.manageOrganization")}
            </Link>
            <Link href="/dashboard" className={primaryBtnClass}>
              {t("invite.goToDashboard")}
            </Link>
          </div>
        </div>
      </InviteShell>
    );
  }

  const orgName = invite.organization?.name || t("invite.organizationFallback");

  return (
    <InviteShell>
      <div className={cardClass}>
        <div className="text-center">
          <div className="mb-6 flex justify-center">
            <OrgMark
              name={orgName}
              logoUrl={invite.organization?.logo_url}
              size={72}
            />
          </div>
          <p className={labelClass}>{t("invite.organizationLabel")}</p>
          <h1 className="mt-2 text-2xl font-medium tracking-[-0.5px] text-white sm:text-3xl">
            {t("invite.joinOrg", { org: orgName })}
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            {t("invite.invitedToJoin")}
          </p>
        </div>

        {invite.organization && (
          <div className="mt-8 rounded-md border border-neutral-800 bg-black/40 p-4">
            <div className={labelClass}>{t("invite.organizationLabel")}</div>
            <div className="mt-2 text-lg font-medium text-white">{invite.organization.name}</div>
            <code className="mt-1 block font-mono text-xs text-neutral-500">
              {invite.organization.slug}
            </code>
          </div>
        )}

        {user ? (
          <div className="mt-6 space-y-4">
            <div className="rounded-md border border-neutral-800 bg-black/40 p-4">
              <div className={labelClass}>{t("invite.joiningAs")}</div>
              <div className="mt-2 text-sm text-neutral-200">{user.email}</div>
            </div>
            <button
              onClick={handleAccept}
              disabled={accepting}
              className={primaryBtnClass}
            >
              {accepting ? t("invite.joining") : t("invite.acceptInvite")}
            </button>
          </div>
        ) : (
          <div className="mt-6 space-y-4">
            <p className="text-center text-sm text-neutral-400">
              {t("invite.loginToAccept")}
            </p>
            <div className="flex flex-col gap-3 sm:flex-row">
              <Link
                href={`/login?redirect=${encodeURIComponent(`/invite/${token}`)}`}
                className={secondaryBtnClass}
              >
                {t("invite.logIn")}
              </Link>
              <Link
                href={`/register?inviteToken=${encodeURIComponent(token)}`}
                className={primaryBtnClass}
              >
                {t("invite.signUp")}
              </Link>
            </div>
          </div>
        )}
      </div>
    </InviteShell>
  );
}
