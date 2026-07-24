"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
} from "@/lib/pow-api/tap-link-config";
import {
  buildGuestLinkBrowseRows,
  collectGuestLinkBrowseStatuses,
  filterGuestLinkBrowseRows,
  type GuestLinkBrowseKindFilter,
  type GuestLinkBrowseRow,
  type GuestLinkBrowseStatusFilter,
} from "@/lib/guest-link-browse";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";

interface WorkspaceBlock {
  id: string;
  title: string | null;
  is_start: boolean | null;
}

interface TapLinkRow {
  id: string;
  block_id: string | null;
  status: string;
  requested_duration_seconds: number;
  participant_type: string | null;
  post_session: string;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface IleLinkRow {
  id: string;
  block_id: string;
  status: string;
  participant_type: string | null;
  guest_user_id: string | null;
  assigned_user_id: string | null;
  session_id: string | null;
  created_at: string;
  completed_at: string | null;
}

interface OrgMember {
  id: string;
  email: string | null;
  username: string | null;
}

type GuestLinksInnerTab = "create" | "browse";

function participantLabel(
  link: {
    participant_type: string | null;
    assigned_user_id: string | null;
    guest_user_id: string | null;
  },
  t: (key: string) => string,
) {
  if (link.participant_type === "anonymous") return t("planView.tapLinksParticipantAnonymous");
  if (link.participant_type === "user" || link.assigned_user_id)
    return t("planView.tapLinksParticipantMember");
  if (link.participant_type === "guest" || link.guest_user_id)
    return t("planView.tapLinksParticipantGuest");
  return "—";
}

function memberLabel(member: OrgMember): string {
  return member.username || member.email || member.id.slice(0, 8);
}

interface WorkspaceGuestLinksPanelProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
}

/**
 * Owner settings: create and browse TAP / ILE guest links for the workspace.
 * Create and Browse are separate inner tabs so large link lists stay manageable.
 */
export function WorkspaceGuestLinksPanel({
  workspaceId,
  isOwner,
  currentUserId,
}: WorkspaceGuestLinksPanelProps) {
  const { t } = useI18n();
  const [innerTab, setInnerTab] = useState<GuestLinksInnerTab>("create");
  const [blocks, setBlocks] = useState<WorkspaceBlock[]>([]);
  const [tapLinks, setTapLinks] = useState<TapLinkRow[]>([]);
  const [ileLinks, setIleLinks] = useState<IleLinkRow[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedIleBlockId, setSelectedIleBlockId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [selectedIleMemberId, setSelectedIleMemberId] = useState("");
  const [minutes, setMinutes] = useState(TAP_LINK_DEFAULT_MINUTES);
  /** Default yes — guest TAP/ILE sessions show End Session unless unchecked. */
  const [showEndSession, setShowEndSession] = useState(true);
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [creatingIleLink, setCreatingIleLink] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [createIleError, setCreateIleError] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<Record<string, string>>({});
  const [invalidating, setInvalidating] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseKind, setBrowseKind] = useState<GuestLinkBrowseKindFilter>("all");
  const [browseStatus, setBrowseStatus] = useState<GuestLinkBrowseStatusFilter>("all");

  const fieldClass =
    "mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white";
  const secondaryBtnClass =
    "rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-white transition hover:border-neutral-500 disabled:opacity-40";
  const primaryBtnClass =
    "rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40";

  const blockTitleById = useMemo(() => {
    return new Map(blocks.map((block) => [block.id, block.title || block.id]));
  }, [blocks]);

  const browseRows = useMemo(() => {
    return buildGuestLinkBrowseRows(tapLinks, ileLinks, {
      blockTitleById,
      entireWorkspaceLabel: t("planView.tapLinksEntireWorkspace"),
      participantLabelFor: (link) => participantLabel(link, t),
    });
  }, [blockTitleById, ileLinks, t, tapLinks]);

  const filteredBrowseRows = useMemo(() => {
    return filterGuestLinkBrowseRows(browseRows, {
      query: browseQuery,
      kind: browseKind,
      status: browseStatus,
    });
  }, [browseKind, browseQuery, browseRows, browseStatus]);

  const browseStatuses = useMemo(
    () => collectGuestLinkBrowseStatuses(browseRows),
    [browseRows],
  );

  const loadTapResources = useCallback(async () => {
    if (!currentUserId || !isOwner) return;
    setLinksLoading(true);
    setLinksError(null);
    try {
      const [linksRes, ileRes, orgRes] = await Promise.all([
        fetch(`/api/workspace/tap-links?workspaceId=${encodeURIComponent(workspaceId)}`),
        fetch(`/api/workspace/ile-links?workspaceId=${encodeURIComponent(workspaceId)}`),
        fetch("/api/organization"),
      ]);

      const linksData = await linksRes.json();
      if (!linksRes.ok) throw new Error(linksData.error || t("planView.tapLinksLoadError"));

      const ileData = await ileRes.json();
      if (!ileRes.ok) throw new Error(ileData.error || t("planView.ileLinksLoadError"));

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: blockRows } = await supabase
        .from("blocks")
        .select("id, title, is_start")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      const nextBlocks = blockRows || [];
      setBlocks(nextBlocks);
      setTapLinks(linksData.tap_links || []);
      setIleLinks(ileData.ile_links || []);

      setSelectedIleBlockId((current) => {
        if (current) return current;
        if (nextBlocks.length === 0) return "";
        const startBlock = nextBlocks.find((b) => b.is_start) || nextBlocks[0];
        return startBlock.id;
      });

      if (orgRes.ok) {
        const orgData = await orgRes.json();
        const members = Array.isArray(orgData.members) ? orgData.members : [];
        setOrgMembers(
          members
            .filter((member: OrgMember) => member.id !== currentUserId)
            .map((member: OrgMember) => ({
              id: member.id,
              email: member.email,
              username: member.username,
            })),
        );
      }
    } catch (error) {
      setLinksError(error instanceof Error ? error.message : t("planView.tapLinksLoadError"));
    } finally {
      setLinksLoading(false);
    }
  }, [currentUserId, isOwner, t, workspaceId]);

  useEffect(() => {
    if (isOwner && currentUserId) {
      void loadTapResources();
    }
  }, [currentUserId, isOwner, loadTapResources]);

  const createTapLink = useCallback(
    async (participantType: "anonymous" | "user") => {
      setCreatingLink(true);
      setCreateError(null);
      try {
        // Session links always end with thank-you (no after-session redirect/results choices).
        const body: Record<string, unknown> = {
          workspaceId,
          minutes,
          participant_type: participantType,
          post_session: "show_results",
          show_end_session: showEndSession,
          access_mode: "private",
        };
        if (selectedBlockId) {
          body.blockId = selectedBlockId;
        }
        if (participantType === "user") {
          if (!selectedMemberId) throw new Error(t("planView.tapLinksSelectMember"));
          body.user_id = selectedMemberId;
        }

        const response = await fetch("/api/workspace/tap-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("planView.tapLinksCreateError"));

        const linkUrl =
          (data.tap_link?.url as string | undefined) ||
          (data.tap_link?.private_url as string | undefined);
        if (linkUrl && data.tap_link?.id) {
          setCreatedLinks((current) => ({ ...current, [data.tap_link.id]: linkUrl }));
        }
        await loadTapResources();
        setInnerTab("browse");
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : t("planView.tapLinksCreateError"));
      } finally {
        setCreatingLink(false);
      }
    },
    [loadTapResources, minutes, selectedBlockId, selectedMemberId, showEndSession, t, workspaceId],
  );

  /** Same card: rotate private URL; keep guest, scope, duration, post-session. */
  const reissueTapLink = useCallback(
    async (linkId: string) => {
      setCreatingLink(true);
      setCreateError(null);
      try {
        const response = await fetch("/api/workspace/tap-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, reissue_link_id: linkId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("planView.tapLinksCreateError"));

        const linkUrl =
          (data.tap_link?.url as string | undefined) ||
          (data.tap_link?.private_url as string | undefined);
        if (linkUrl && data.tap_link?.id) {
          setCreatedLinks((current) => ({ ...current, [data.tap_link.id]: linkUrl }));
        }
        await loadTapResources();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : t("planView.tapLinksCreateError"));
      } finally {
        setCreatingLink(false);
      }
    },
    [loadTapResources, t, workspaceId],
  );

  const invalidateTapLink = useCallback(
    async (linkId: string) => {
      if (!window.confirm(t("planView.tapLinksInvalidateConfirm"))) return;
      setInvalidating(true);
      setCreateError(null);
      try {
        const response = await fetch("/api/workspace/tap-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, invalidate_link_id: linkId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("planView.tapLinksInvalidateError"));
        setCreatedLinks((current) => {
          const next = { ...current };
          delete next[linkId];
          return next;
        });
        await loadTapResources();
      } catch (error) {
        setCreateError(
          error instanceof Error ? error.message : t("planView.tapLinksInvalidateError"),
        );
      } finally {
        setInvalidating(false);
      }
    },
    [loadTapResources, t, workspaceId],
  );

  const invalidateAllTapLinks = useCallback(async () => {
    if (!window.confirm(t("planView.tapLinksInvalidateAllConfirm"))) return;
    setInvalidating(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/workspace/tap-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, invalidate_all: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("planView.tapLinksInvalidateError"));
      const ids = Array.isArray(data.invalidated?.ids) ? (data.invalidated.ids as string[]) : [];
      setCreatedLinks((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        // Drop any other TAP ids we still hold if bulk succeeded
        for (const id of Object.keys(next)) {
          if (tapLinks.some((link) => link.id === id)) delete next[id];
        }
        return next;
      });
      await loadTapResources();
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : t("planView.tapLinksInvalidateError"),
      );
    } finally {
      setInvalidating(false);
    }
  }, [loadTapResources, t, tapLinks, workspaceId]);

  const createIleLink = useCallback(
    async (participantType: "anonymous" | "user") => {
      setCreatingIleLink(true);
      setCreateIleError(null);
      try {
        if (!selectedIleBlockId) {
          throw new Error(t("planView.ileLinksSelectBlock"));
        }
        const body: Record<string, unknown> = {
          workspaceId,
          blockId: selectedIleBlockId,
          participant_type: participantType,
          show_end_session: showEndSession,
          access_mode: "private",
        };
        if (participantType === "user") {
          if (!selectedIleMemberId) throw new Error(t("planView.tapLinksSelectMember"));
          body.user_id = selectedIleMemberId;
        }

        const response = await fetch("/api/workspace/ile-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("planView.ileLinksCreateError"));

        const linkUrl =
          (data.ile_link?.url as string | undefined) ||
          (data.ile_link?.private_url as string | undefined);
        if (linkUrl && data.ile_link?.id) {
          setCreatedLinks((current) => ({ ...current, [data.ile_link.id]: linkUrl }));
        }
        await loadTapResources();
        setInnerTab("browse");
      } catch (error) {
        setCreateIleError(
          error instanceof Error ? error.message : t("planView.ileLinksCreateError"),
        );
      } finally {
        setCreatingIleLink(false);
      }
    },
    [loadTapResources, selectedIleBlockId, selectedIleMemberId, showEndSession, t, workspaceId],
  );

  /** Same card: rotate private URL; keep guest and block scope. */
  const reissueIleLink = useCallback(
    async (linkId: string) => {
      setCreatingIleLink(true);
      setCreateIleError(null);
      try {
        const response = await fetch("/api/workspace/ile-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, reissue_link_id: linkId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("planView.ileLinksCreateError"));

        const linkUrl =
          (data.ile_link?.url as string | undefined) ||
          (data.ile_link?.private_url as string | undefined);
        if (linkUrl && data.ile_link?.id) {
          setCreatedLinks((current) => ({ ...current, [data.ile_link.id]: linkUrl }));
        }
        await loadTapResources();
      } catch (error) {
        setCreateIleError(
          error instanceof Error ? error.message : t("planView.ileLinksCreateError"),
        );
      } finally {
        setCreatingIleLink(false);
      }
    },
    [loadTapResources, t, workspaceId],
  );

  const invalidateIleLink = useCallback(
    async (linkId: string) => {
      if (!window.confirm(t("planView.ileLinksInvalidateConfirm"))) return;
      setInvalidating(true);
      setCreateIleError(null);
      try {
        const response = await fetch("/api/workspace/ile-links", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, invalidate_link_id: linkId }),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || t("planView.ileLinksInvalidateError"));
        setCreatedLinks((current) => {
          const next = { ...current };
          delete next[linkId];
          return next;
        });
        await loadTapResources();
      } catch (error) {
        setCreateIleError(
          error instanceof Error ? error.message : t("planView.ileLinksInvalidateError"),
        );
      } finally {
        setInvalidating(false);
      }
    },
    [loadTapResources, t, workspaceId],
  );

  const invalidateAllIleLinks = useCallback(async () => {
    if (!window.confirm(t("planView.ileLinksInvalidateAllConfirm"))) return;
    setInvalidating(true);
    setCreateIleError(null);
    try {
      const response = await fetch("/api/workspace/ile-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, invalidate_all: true }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || t("planView.ileLinksInvalidateError"));
      const ids = Array.isArray(data.invalidated?.ids) ? (data.invalidated.ids as string[]) : [];
      setCreatedLinks((current) => {
        const next = { ...current };
        for (const id of ids) delete next[id];
        for (const id of Object.keys(next)) {
          if (ileLinks.some((link) => link.id === id)) delete next[id];
        }
        return next;
      });
      await loadTapResources();
    } catch (error) {
      setCreateIleError(
        error instanceof Error ? error.message : t("planView.ileLinksInvalidateError"),
      );
    } finally {
      setInvalidating(false);
    }
  }, [ileLinks, loadTapResources, t, workspaceId]);

  const copyLink = useCallback(
    async (linkId: string, url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedLinkId(linkId);
        window.setTimeout(() => setCopiedLinkId(null), 2000);
      } catch {
        setCreateError(t("planView.tapLinksCreateError"));
      }
    },
    [t],
  );

  const renderBrowseRow = (link: GuestLinkBrowseRow) => {
    const isRevoked = link.status === "revoked";
    // Revoked links are not copyable (keep expression shape for structural tests).
    const privateUrl = isRevoked ? undefined : createdLinks[link.id];
    const isTap = link.kind === "tap";
    const busy = invalidating || (isTap ? creatingLink : creatingIleLink);

    return (
      <li
        key={`${link.kind}-${link.id}`}
        data-guest-link-status={link.status}
        data-guest-link-kind={link.kind}
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-800 px-3 py-2 text-xs"
      >
        <div className="min-w-0 text-neutral-400">
          <p className="text-neutral-300">
            <span className="mr-2 rounded border border-neutral-700 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-neutral-300">
              {isTap ? "TAP" : "ILE"}
            </span>
            {t("planView.tapLinksStatus")}: {link.status}
            {isRevoked ? (
              <span className="ml-1 text-red-400/90">
                (
                {isTap
                  ? t("planView.tapLinksRevokedHint")
                  : t("planView.ileLinksRevokedHint")}
                )
              </span>
            ) : null}
          </p>
          <p>
            {isTap ? t("planView.tapLinksScope") : t("planView.ileLinksBlock")}: {link.scopeLabel}
          </p>
          <p>
            {t("planView.tapLinksParticipant")}: {link.participantLabel}
            {link.guest_user_id ? (
              <span className="ml-1 font-mono text-neutral-500">
                ({link.guest_user_id.slice(0, 8)}…)
              </span>
            ) : null}
          </p>
          {isTap && link.requested_duration_seconds != null ? (
            <p>{Math.round(link.requested_duration_seconds / 60)} min</p>
          ) : null}
          <p className="font-mono text-[10px] text-neutral-600">{link.id}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {link.guest_user_id ? (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                void (isTap ? reissueTapLink(link.id) : reissueIleLink(link.id))
              }
              className="rounded-md border border-neutral-700 px-2.5 py-1.5 text-xs text-neutral-300 transition hover:border-neutral-500"
            >
              {isTap ? t("planView.tapLinksReuseGuest") : t("planView.ileLinksReuseGuest")}
            </button>
          ) : null}
          {!isRevoked && isTap ? (
            <button
              type="button"
              disabled={invalidating || creatingLink}
              onClick={() => void invalidateTapLink(link.id)}
              data-guest-link-invalidate="tap"
              className="rounded-md border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 transition hover:border-red-700 disabled:opacity-40"
            >
              {t("planView.tapLinksInvalidate")}
            </button>
          ) : null}
          {!isRevoked && !isTap ? (
            <button
              type="button"
              disabled={invalidating || creatingIleLink}
              onClick={() => void invalidateIleLink(link.id)}
              data-guest-link-invalidate="ile"
              className="rounded-md border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 transition hover:border-red-700 disabled:opacity-40"
            >
              {t("planView.ileLinksInvalidate")}
            </button>
          ) : null}
          {privateUrl ? (
            <button
              type="button"
              onClick={() => void copyLink(link.id, privateUrl)}
              className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs text-white transition hover:border-neutral-400"
            >
              {copiedLinkId === link.id
                ? t("planView.tapLinksCopied")
                : t("planView.tapLinksCopy")}
            </button>
          ) : null}
        </div>
      </li>
    );
  };

  if (!isOwner || !currentUserId) {
    return (
      <section
        className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
        data-settings-section="guest-links"
      >
        <p className="text-xs text-neutral-500">{t("planView.tapIleLinksOwnerOnly")}</p>
      </section>
    );
  }

  const innerTabs = [
    { id: "create" as const, label: t("planView.guestLinksTabCreate") },
    { id: "browse" as const, label: t("planView.guestLinksTabBrowse") },
  ];

  return (
    <div className="flex w-full flex-col gap-0" data-settings-section="guest-links">
      <div
        className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 backdrop-blur-md"
        data-guest-links-inner-tabs
      >
        <WorkspaceSectionSubTabs
          activeId={innerTab}
          onChange={setInnerTab}
          tabs={innerTabs}
          ariaLabel={t("planView.guestLinksInnerTabsAria")}
        />

        {innerTab === "create" ? (
          <div
            className="flex flex-col gap-5 p-5 sm:p-6"
            data-guest-links-inner-tab="create"
            role="tabpanel"
          >
            <div>
              <h3 className="text-sm font-medium text-white">{t("planView.tapLinksTitle")}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                {t("planView.tapLinksHint")}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-neutral-400">
                  {t("planView.tapLinksScope")}
                  <select
                    value={selectedBlockId}
                    onChange={(event) => setSelectedBlockId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">{t("planView.tapLinksEntireWorkspace")}</option>
                    {blocks.map((block) => (
                      <option key={block.id} value={block.id}>
                        {block.title || block.id}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="block text-xs text-neutral-400">
                  {t("planView.tapLinksMinutes")}
                  <input
                    type="number"
                    min={TAP_LINK_MIN_MINUTES}
                    max={TAP_LINK_MAX_MINUTES}
                    value={minutes}
                    onChange={(event) =>
                      setMinutes(Number(event.target.value) || TAP_LINK_DEFAULT_MINUTES)
                    }
                    className={fieldClass}
                  />
                </label>
              </div>

              <label className="mt-4 flex cursor-pointer items-start gap-2.5 text-xs text-neutral-400">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-neutral-700 bg-neutral-900"
                  checked={showEndSession}
                  onChange={(e) => setShowEndSession(e.target.checked)}
                  data-guest-link-show-end-session
                />
                <span>
                  <span className="font-medium text-neutral-300">Show End Session button</span>
                  <span className="mt-0.5 block text-neutral-500">
                    Default on. Uncheck for open-ended runs. Share the same link with different query
                    params (e.g. ?candidate_id=…) to attribute PoW to different guests.
                  </span>
                </span>
              </label>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={creatingLink}
                  onClick={() => void createTapLink("anonymous")}
                  className={primaryBtnClass}
                >
                  {creatingLink
                    ? t("planView.tapLinksCreating")
                    : t("planView.tapLinksCreateAnonymous")}
                </button>

                {orgMembers.length > 0 ? (
                  <>
                    <select
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                    >
                      <option value="">{t("planView.tapLinksSelectMember")}</option>
                      {orgMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {memberLabel(member)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={creatingLink || !selectedMemberId}
                      onClick={() => void createTapLink("user")}
                      className={secondaryBtnClass}
                    >
                      {creatingLink
                        ? t("planView.tapLinksCreating")
                        : t("planView.tapLinksCreateMember")}
                    </button>
                  </>
                ) : null}
              </div>

              {createError ? <p className="mt-3 text-xs text-red-400">{createError}</p> : null}
            </div>

            <div className="border-t border-neutral-800/80 pt-5">
              <h3 className="text-sm font-medium text-white">{t("planView.ileLinksTitle")}</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                {t("planView.ileLinksHint")}
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-neutral-400 sm:col-span-2">
                  {t("planView.ileLinksBlock")}
                  <select
                    value={selectedIleBlockId}
                    onChange={(event) => setSelectedIleBlockId(event.target.value)}
                    className={fieldClass}
                  >
                    <option value="">{t("planView.ileLinksSelectBlock")}</option>
                    {blocks.map((block) => (
                      <option key={block.id} value={block.id}>
                        {block.title || block.id}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={creatingIleLink || !selectedIleBlockId}
                  onClick={() => void createIleLink("anonymous")}
                  className={primaryBtnClass}
                >
                  {creatingIleLink
                    ? t("planView.ileLinksCreating")
                    : t("planView.ileLinksCreateAnonymous")}
                </button>

                {orgMembers.length > 0 ? (
                  <>
                    <select
                      value={selectedIleMemberId}
                      onChange={(event) => setSelectedIleMemberId(event.target.value)}
                      className="rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                    >
                      <option value="">{t("planView.tapLinksSelectMember")}</option>
                      {orgMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {memberLabel(member)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={creatingIleLink || !selectedIleBlockId || !selectedIleMemberId}
                      onClick={() => void createIleLink("user")}
                      className={secondaryBtnClass}
                    >
                      {creatingIleLink
                        ? t("planView.ileLinksCreating")
                        : t("planView.ileLinksCreateMember")}
                    </button>
                  </>
                ) : null}
              </div>

              {createIleError ? (
                <p className="mt-3 text-xs text-red-400">{createIleError}</p>
              ) : null}
              {linksError ? <p className="mt-3 text-xs text-red-400">{linksError}</p> : null}
            </div>
          </div>
        ) : null}

        {innerTab === "browse" ? (
          <div
            className="flex flex-col gap-4 p-5 sm:p-6"
            data-guest-links-inner-tab="browse"
            role="tabpanel"
          >
            <div>
              <h3 className="text-sm font-medium text-white">
                {t("planView.guestLinksBrowseTitle")}
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                {t("planView.guestLinksBrowseHint")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <label className="block text-xs text-neutral-400 sm:col-span-1">
                {t("planView.guestLinksSearchLabel")}
                <input
                  type="search"
                  value={browseQuery}
                  onChange={(event) => setBrowseQuery(event.target.value)}
                  placeholder={t("planView.guestLinksSearchPlaceholder")}
                  className={fieldClass}
                  data-guest-links-search
                />
              </label>
              <label className="block text-xs text-neutral-400">
                {t("planView.guestLinksFilterKind")}
                <select
                  value={browseKind}
                  onChange={(event) =>
                    setBrowseKind(event.target.value as GuestLinkBrowseKindFilter)
                  }
                  className={fieldClass}
                  data-guest-links-filter-kind
                >
                  <option value="all">{t("planView.guestLinksFilterKindAll")}</option>
                  <option value="tap">{t("planView.guestLinksFilterKindTap")}</option>
                  <option value="ile">{t("planView.guestLinksFilterKindIle")}</option>
                </select>
              </label>
              <label className="block text-xs text-neutral-400">
                {t("planView.guestLinksFilterStatus")}
                <select
                  value={browseStatus}
                  onChange={(event) => setBrowseStatus(event.target.value)}
                  className={fieldClass}
                  data-guest-links-filter-status
                >
                  <option value="all">{t("planView.guestLinksFilterStatusAll")}</option>
                  {browseStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-neutral-500">
                {t("planView.guestLinksBrowseCount")
                  .replace("{shown}", String(filteredBrowseRows.length))
                  .replace("{total}", String(browseRows.length))}
              </p>
              <div className="flex flex-wrap gap-2">
                {tapLinks.some((link) => link.status !== "revoked") ? (
                  <button
                    type="button"
                    disabled={invalidating || creatingLink}
                    onClick={() => void invalidateAllTapLinks()}
                    data-guest-link-invalidate-all="tap"
                    className="rounded-md border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 transition hover:border-red-700 disabled:opacity-40"
                  >
                    {invalidating
                      ? t("planView.tapLinksInvalidating")
                      : t("planView.tapLinksInvalidateAll")}
                  </button>
                ) : null}
                {ileLinks.some((link) => link.status !== "revoked") ? (
                  <button
                    type="button"
                    disabled={invalidating || creatingIleLink}
                    onClick={() => void invalidateAllIleLinks()}
                    data-guest-link-invalidate-all="ile"
                    className="rounded-md border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 transition hover:border-red-700 disabled:opacity-40"
                  >
                    {invalidating
                      ? t("planView.ileLinksInvalidating")
                      : t("planView.ileLinksInvalidateAll")}
                  </button>
                ) : null}
              </div>
            </div>

            {createError ? <p className="text-xs text-red-400">{createError}</p> : null}
            {createIleError ? <p className="text-xs text-red-400">{createIleError}</p> : null}
            {linksError ? <p className="text-xs text-red-400">{linksError}</p> : null}

            {linksLoading ? (
              <div>
                <LoadingStatusMessage
                  size="sm"
                  tone="subtle"
                  message={t("planView.tapLinksCreating")}
                />
              </div>
            ) : browseRows.length === 0 ? (
              <p className="text-xs text-neutral-600">{t("planView.guestLinksBrowseEmpty")}</p>
            ) : filteredBrowseRows.length === 0 ? (
              <p className="text-xs text-neutral-600">
                {t("planView.guestLinksBrowseNoMatches")}
              </p>
            ) : (
              <ul className="space-y-2" data-guest-links-browse-list>
                {filteredBrowseRows.map((row) => renderBrowseRow(row))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
