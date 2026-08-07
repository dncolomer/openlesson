"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  TAP_LINK_DEFAULT_MINUTES,
  TAP_LINK_MAX_MINUTES,
  TAP_LINK_MIN_MINUTES,
} from "@/lib/pow-api/tap-link-config";
import {
  productIntentClusterLabel,
  productIntentFromGuestLink,
  PRODUCT_INTENT_LABELS,
  resolveProductIntent,
} from "@/lib/product-intent";
import {
  buildGuestLinkBrowseRows,
  collectGuestLinkBrowseStatuses,
  filterGuestLinkBrowseRows,
  type GuestLinkBrowseKindFilter,
  type GuestLinkBrowseRow,
  type GuestLinkBrowseStatusFilter,
} from "@/lib/guest-link-browse";
import {
  buildTapbenchSkillsMarkdown,
  downloadTapbenchSkillsMarkdown,
  TAPBENCH_SKILLS_MD_FILENAME,
} from "@/lib/pow-api/tapbench-skills-md";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import type { TapbenchLinkRow } from "@/components/WorkspaceTapbenchLinksPanel";

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
  interaction_kind?: string | null;
  /** Always-visible share URL from list API (public_token). */
  url?: string | null;
  private_url?: string | null;
  public_token?: string | null;
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
  /** learning (default) | project */
  session_mode?: string | null;
  /** Always-visible share URL from list API (public_token). */
  url?: string | null;
  private_url?: string | null;
  public_token?: string | null;
}

interface OrgMember {
  id: string;
  email: string | null;
  username: string | null;
}

type GuestLinksInnerTab = "create" | "browse";

/** Single create surface product kind (portal-style compact selector). */
type CreateProductKind =
  | "timed_explore"
  | "timed_drill"
  | "open_ended_explore"
  | "open_ended_drill"
  | "tapbench";

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
 * Owner settings: create and browse shareable practice links.
 * Portal-inspired: Create | Browse only; one create form for TAP/ILE/TAPBench.
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
  const [tapbenchLinks, setTapbenchLinks] = useState<TapbenchLinkRow[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  /** Shared scope block (optional for timed/TAPBench; required for open-ended). */
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [minutes, setMinutes] = useState(TAP_LINK_DEFAULT_MINUTES);
  /** Default yes — guest sessions show End Session unless unchecked. */
  const [showEndSession, setShowEndSession] = useState(true);
  /** Compact product selector (replaces dual timed + dual open-ended + TAPBench stacks). */
  const [createProduct, setCreateProduct] =
    useState<CreateProductKind>("timed_explore");
  /** anonymous (default) or assigned org member */
  const [participantMode, setParticipantMode] = useState<"anonymous" | "user">(
    "anonymous",
  );
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [creatingIleLink, setCreatingIleLink] = useState(false);
  const [mintingTapbench, setMintingTapbench] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<Record<string, string>>({});
  const [invalidating, setInvalidating] = useState(false);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseKind, setBrowseKind] = useState<GuestLinkBrowseKindFilter>("all");
  const [browseStatus, setBrowseStatus] = useState<GuestLinkBrowseStatusFilter>("all");

  const isTimedProduct =
    createProduct === "timed_explore" || createProduct === "timed_drill";
  const isOpenEndedProduct =
    createProduct === "open_ended_explore" || createProduct === "open_ended_drill";
  const isTapbenchProduct = createProduct === "tapbench";
  const timedStyle =
    createProduct === "timed_drill" ? ("drill" as const) : ("explore" as const);
  const openEndedStyle =
    createProduct === "open_ended_drill" ? ("drill" as const) : ("explore" as const);
  // Back-compat data hooks for exercise / project mode markers
  const exerciseTap = timedStyle === "drill";
  const ileProjectMode = openEndedStyle === "drill";
  const creatingBusy = creatingLink || creatingIleLink || mintingTapbench;

  const fieldClass =
    "mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white";
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
      tapbenchLinks,
      tapbenchParticipantLabel: "Agent",
    });
  }, [blockTitleById, ileLinks, t, tapLinks, tapbenchLinks]);

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
      const [linksRes, ileRes, tbRes, orgRes] = await Promise.all([
        fetch(`/api/workspace/tap-links?workspaceId=${encodeURIComponent(workspaceId)}`),
        fetch(`/api/workspace/ile-links?workspaceId=${encodeURIComponent(workspaceId)}`),
        fetch(
          `/api/workspace/tapbench-links?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
        fetch("/api/organization"),
      ]);

      const linksData = await linksRes.json();
      if (!linksRes.ok) throw new Error(linksData.error || t("planView.tapLinksLoadError"));

      const ileData = await ileRes.json();
      if (!ileRes.ok) throw new Error(ileData.error || t("planView.ileLinksLoadError"));

      const tbData = await tbRes.json().catch(() => ({}));
      if (tbRes.ok) {
        setTapbenchLinks(
          Array.isArray(tbData.tapbench_links) ? tbData.tapbench_links : [],
        );
      } else {
        setTapbenchLinks([]);
      }

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

      setSelectedBlockId((current) => {
        if (current) return current;
        if (nextBlocks.length === 0) return "";
        // Prefer empty (workspace) for timed; preselect start for open-ended convenience.
        return "";
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
          interaction_kind: resolveProductIntent(timedStyle, "timed").interaction_kind,
          exercise: timedStyle === "drill",
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
    [
      timedStyle,
      loadTapResources,
      minutes,
      selectedBlockId,
      selectedMemberId,
      showEndSession,
      t,
      workspaceId,
    ],
  );

  const mintTapbenchLink = useCallback(async () => {
    setMintingTapbench(true);
    setCreateError(null);
    try {
      const response = await fetch("/api/workspace/tapbench-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          minutes,
          ...(selectedBlockId ? { blockId: selectedBlockId } : {}),
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create TAPBench link");
      await loadTapResources();
      setInnerTab("browse");
    } catch (error) {
      setCreateError(
        error instanceof Error ? error.message : "Failed to create TAPBench link",
      );
    } finally {
      setMintingTapbench(false);
    }
  }, [loadTapResources, minutes, selectedBlockId, workspaceId]);

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
      setCreateError(null);
      try {
        if (!selectedBlockId) {
          throw new Error(t("planView.ileLinksSelectBlock"));
        }
        const body: Record<string, unknown> = {
          workspaceId,
          blockId: selectedBlockId,
          participant_type: participantType,
          show_end_session: showEndSession,
          access_mode: "private",
          session_mode: resolveProductIntent(openEndedStyle, "open_ended").session_mode,
          project: openEndedStyle === "drill",
        };
        if (participantType === "user") {
          if (!selectedMemberId) throw new Error(t("planView.tapLinksSelectMember"));
          body.user_id = selectedMemberId;
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
        setCreateError(
          error instanceof Error ? error.message : t("planView.ileLinksCreateError"),
        );
      } finally {
        setCreatingIleLink(false);
      }
    },
    [
      loadTapResources,
      selectedBlockId,
      selectedMemberId,
      showEndSession,
      openEndedStyle,
      t,
      workspaceId,
    ],
  );

  /** Single primary create action — dispatches by selected product kind. */
  const createSelectedLink = useCallback(async () => {
    const participantType =
      participantMode === "user" && orgMembers.length > 0 ? "user" : "anonymous";
    if (isTapbenchProduct) {
      await mintTapbenchLink();
      return;
    }
    if (isOpenEndedProduct) {
      await createIleLink(participantType);
      return;
    }
    await createTapLink(participantType);
  }, [
    createIleLink,
    createTapLink,
    isOpenEndedProduct,
    isTapbenchProduct,
    mintTapbenchLink,
    orgMembers.length,
    participantMode,
  ]);

  /** Same card: rotate private URL; keep guest and block scope. */
  const reissueIleLink = useCallback(
    async (linkId: string) => {
      setCreatingIleLink(true);
      setCreateError(null);
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
        setCreateError(
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
      setCreateError(null);
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
        setCreateError(
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
    setCreateError(null);
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
      setCreateError(
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

  const downloadTapbenchSkills = useCallback(
    (link: TapbenchLinkRow) => {
      const origin = typeof window !== "undefined" ? window.location.origin : undefined;
      const ok = downloadTapbenchSkillsMarkdown({
        workspace_id: link.workspace_id || workspaceId,
        block_id: link.block_id,
        id: link.id,
        session_token: link.public_token,
        url: link.url,
        exercise: link.exercise,
        duration_seconds: link.duration_seconds,
        expires_at: link.expires_at,
        remaining_ms: link.remaining_ms,
        status: link.status,
        baseUrl: origin,
      });
      if (!ok) {
        const md = buildTapbenchSkillsMarkdown({
          workspace_id: link.workspace_id || workspaceId,
          block_id: link.block_id,
          id: link.id,
          session_token: link.public_token,
          url: link.url,
          exercise: link.exercise,
          duration_seconds: link.duration_seconds,
          expires_at: link.expires_at,
          remaining_ms: link.remaining_ms,
          status: link.status,
          baseUrl: origin,
        });
        const a = document.createElement("a");
        a.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`;
        a.download = TAPBENCH_SKILLS_MD_FILENAME;
        a.setAttribute("data-tapbench-skills-download-anchor", "1");
        a.click();
      }
    },
    [workspaceId],
  );

  const renderBrowseRow = (link: GuestLinkBrowseRow) => {
    const isRevoked = link.status === "revoked";
    const isTap = link.kind === "tap";
    const isIle = link.kind === "ile";
    const isTapbench = link.kind === "tapbench";
    const tbRow = isTapbench
      ? tapbenchLinks.find((row) => row.id === link.id)
      : undefined;
    // Prefer durable list URL (public_token); fall back to just-created client memory.
    const listUrl = isTap
      ? tapLinks.find((row) => row.id === link.id)?.url ||
        tapLinks.find((row) => row.id === link.id)?.private_url
      : isIle
        ? ileLinks.find((row) => row.id === link.id)?.url ||
          ileLinks.find((row) => row.id === link.id)?.private_url
        : link.url || tbRow?.url;
    // Revoked links are not copyable (keep expression shape for structural tests).
    const privateUrl = isRevoked ? undefined : listUrl || createdLinks[link.id];
    const busy =
      invalidating ||
      (isTap ? creatingLink : isIle ? creatingIleLink : mintingTapbench);
    const intent =
      isTap || isIle
        ? productIntentFromGuestLink({
            kind: isTap ? "tap" : "ile",
            session_mode: ileLinks.find((row) => row.id === link.id)?.session_mode,
            interaction_kind: tapLinks.find((row) => row.id === link.id)
              ?.interaction_kind,
          })
        : null;
    const clusterLabel = isTapbench
      ? "TAPBench"
      : intent
        ? productIntentClusterLabel(intent)
        : link.kind;

    return (
      <li
        key={`${link.kind}-${link.id}`}
        data-guest-link-status={link.status}
        data-guest-link-kind={link.kind}
        data-product-intent-id={intent?.id || (isTapbench ? "tapbench" : undefined)}
        data-tapbench-link-id={isTapbench ? link.id : undefined}
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-800 px-3 py-2 text-xs"
      >
        <div className="min-w-0 text-neutral-400">
          <p className="text-neutral-300">
            <span
              className="mr-2 rounded border border-neutral-600 px-1.5 py-0.5 text-[10px] font-medium tracking-wide text-neutral-200"
              data-guest-link-intent-badge
            >
              {clusterLabel}
            </span>
            {isTap && intent?.interaction_kind === "exercise" ? (
              <span
                data-guest-link-interaction-kind="exercise"
                className="mr-2 hidden"
              />
            ) : null}
            {isIle && intent?.session_mode === "project" ? (
              <span
                data-guest-link-session-mode="project"
                data-ile-project-mode-badge
                className="mr-2 hidden"
              />
            ) : null}
            Status: {link.status}
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
            {isIle ? t("planView.ileLinksBlock") : t("planView.tapLinksScope")}:{" "}
            {link.scopeLabel}
          </p>
          <p>
            {t("planView.tapLinksParticipant")}: {link.participantLabel}
            {link.guest_user_id ? (
              <span className="ml-1 font-mono text-neutral-500">
                ({link.guest_user_id.slice(0, 8)}…)
              </span>
            ) : null}
          </p>
          {(isTap || isTapbench) && link.requested_duration_seconds != null ? (
            <p>{Math.round(link.requested_duration_seconds / 60)} min</p>
          ) : null}
          {isTapbench && link.detail ? (
            <p className="mt-0.5 line-clamp-2 text-neutral-300">{link.detail}</p>
          ) : null}
          {isTapbench && privateUrl ? (
            <p
              className="mt-0.5 break-all font-mono text-[10px] text-neutral-200/90"
              data-tapbench-link-url
            >
              {privateUrl}
            </p>
          ) : null}
          <p className="font-mono text-[10px] text-neutral-600">{link.id}</p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {link.guest_user_id && (isTap || isIle) ? (
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
          {!isRevoked && isIle ? (
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
          {isTapbench && tbRow ? (
            <button
              type="button"
              onClick={() => downloadTapbenchSkills(tbRow)}
              className="rounded-md border border-neutral-800/60 bg-neutral-950/30 px-2.5 py-1.5 text-[11px] text-neutral-300 transition hover:border-white/60"
              data-download-tapbench-skills
              data-tapbench-skills-md
              title={`Download ${TAPBENCH_SKILLS_MD_FILENAME} for agents (Stash/Submit)`}
            >
              Download skills.md
            </button>
          ) : null}
          {privateUrl ? (
            <button
              type="button"
              onClick={() => void copyLink(link.id, privateUrl)}
              className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs text-white transition hover:border-neutral-400"
              data-copy-tapbench-link={isTapbench ? true : undefined}
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

  const productOptions: Array<{
    id: CreateProductKind;
    label: string;
    hint: string;
  }> = [
    {
      id: "timed_explore",
      label: PRODUCT_INTENT_LABELS.timedExplore,
      hint: PRODUCT_INTENT_LABELS.timedExploreHint,
    },
    {
      id: "timed_drill",
      label: PRODUCT_INTENT_LABELS.timedDrill,
      hint: PRODUCT_INTENT_LABELS.timedDrillHint,
    },
    {
      id: "open_ended_explore",
      label: PRODUCT_INTENT_LABELS.openEndedExplore,
      hint: PRODUCT_INTENT_LABELS.openEndedExploreHint,
    },
    {
      id: "open_ended_drill",
      label: PRODUCT_INTENT_LABELS.openEndedDrill,
      hint: PRODUCT_INTENT_LABELS.openEndedDrillHint,
    },
    {
      id: "tapbench",
      label: "TAPBench",
      hint: "Timed agent exercise with Stash/Submit session token.",
    },
  ];

  const createDisabled =
    creatingBusy ||
    (isOpenEndedProduct && !selectedBlockId) ||
    (participantMode === "user" && !selectedMemberId && !isTapbenchProduct);

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
            data-product-intent="guest-links-create"
            data-tapbench-mint
            data-region-tapbench-links
            data-knowledge-links-tapbench
            role="tabpanel"
          >
            <div>
              <h3 className="text-sm font-medium text-white">Create knowledge link</h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                Pick a product, scope, and participant — one create action mints the share link
                (including TAPBench for agents).
              </p>
            </div>

            <fieldset data-guest-links-product-select data-product-intent="create-product">
              <legend className="text-xs text-neutral-400">Product</legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {productOptions.map((opt) => {
                  const selected = createProduct === opt.id;
                  return (
                    <label
                      key={opt.id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-xs transition ${
                        selected
                          ? "border-white bg-white/5 text-white"
                          : "border-neutral-700 bg-neutral-900 text-neutral-400"
                      }`}
                      data-guest-links-product={opt.id}
                    >
                      <input
                        type="radio"
                        name="guest-links-product"
                        className="mt-0.5"
                        checked={selected}
                        onChange={() => setCreateProduct(opt.id)}
                      />
                      <span>
                        <span className="block font-medium text-neutral-100">{opt.label}</span>
                        <span className="mt-0.5 block text-[10px] text-neutral-500">
                          {opt.hint}
                        </span>
                      </span>
                    </label>
                  );
                })}
              </div>
              {/* Structural hooks for timed/open-ended styles (selection via product radios). */}
              <span
                className="hidden"
                data-product-intent="timed-style"
                data-guest-link-exercise-tap={exerciseTap ? "true" : "false"}
              />
              <span
                className="hidden"
                data-product-intent="open-ended-style"
                data-guest-link-ile-project-mode={ileProjectMode ? "true" : "false"}
                data-ile-session-mode={ileProjectMode ? "project" : "learning"}
              />
            </fieldset>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-neutral-400">
                {isOpenEndedProduct
                  ? t("planView.ileLinksBlock")
                  : t("planView.tapLinksScope")}
                <select
                  value={selectedBlockId}
                  onChange={(event) => setSelectedBlockId(event.target.value)}
                  className={fieldClass}
                  data-tapbench-block-select={isTapbenchProduct ? true : undefined}
                >
                  {isOpenEndedProduct ? (
                    <option value="">{t("planView.ileLinksSelectBlock")}</option>
                  ) : (
                    <option value="">{t("planView.tapLinksEntireWorkspace")}</option>
                  )}
                  {blocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.title || block.id}
                      {block.is_start ? " (start)" : ""}
                    </option>
                  ))}
                </select>
              </label>

              {isTimedProduct || isTapbenchProduct ? (
                <label className="block text-xs text-neutral-400">
                  {t("planView.tapLinksMinutes")}
                  <input
                    type="number"
                    min={isTapbenchProduct ? 1 : TAP_LINK_MIN_MINUTES}
                    max={isTapbenchProduct ? 180 : TAP_LINK_MAX_MINUTES}
                    value={minutes}
                    onChange={(event) =>
                      setMinutes(
                        Number(event.target.value) || TAP_LINK_DEFAULT_MINUTES,
                      )
                    }
                    className={fieldClass}
                    data-tapbench-minutes={isTapbenchProduct ? true : undefined}
                  />
                </label>
              ) : null}
            </div>

            {!isTapbenchProduct ? (
              <label className="flex cursor-pointer items-start gap-2.5 text-xs text-neutral-400">
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
                    Default on. Uncheck to hide End Session on the guest runtime.
                  </span>
                </span>
              </label>
            ) : null}

            {!isTapbenchProduct && orgMembers.length > 0 ? (
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block text-xs text-neutral-400">
                  Participant
                  <select
                    value={participantMode}
                    onChange={(e) =>
                      setParticipantMode(e.target.value as "anonymous" | "user")
                    }
                    className={fieldClass}
                    data-guest-links-participant-mode
                  >
                    <option value="anonymous">
                      {t("planView.tapLinksParticipantAnonymous")}
                    </option>
                    <option value="user">{t("planView.tapLinksParticipantMember")}</option>
                  </select>
                </label>
                {participantMode === "user" ? (
                  <label className="block text-xs text-neutral-400">
                    {t("planView.tapLinksSelectMember")}
                    <select
                      value={selectedMemberId}
                      onChange={(event) => setSelectedMemberId(event.target.value)}
                      className={fieldClass}
                    >
                      <option value="">{t("planView.tapLinksSelectMember")}</option>
                      {orgMembers.map((member) => (
                        <option key={member.id} value={member.id}>
                          {memberLabel(member)}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={createDisabled}
                onClick={() => void createSelectedLink()}
                className={primaryBtnClass}
                data-guest-links-create-submit
                data-create-tapbench-link={isTapbenchProduct ? true : undefined}
              >
                {creatingBusy
                  ? isTapbenchProduct
                    ? "Creating…"
                    : isOpenEndedProduct
                      ? t("planView.ileLinksCreating")
                      : t("planView.tapLinksCreating")
                  : isTapbenchProduct
                    ? "Create TAPBench link"
                    : "Create link"}
              </button>
            </div>

            {createError ? (
              <p className="text-xs text-red-400" data-guest-links-create-error>
                {createError}
              </p>
            ) : null}
            {linksError ? <p className="text-xs text-red-400">{linksError}</p> : null}
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
                  <option value="tapbench">TAPBench</option>
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
              <ul
                className="space-y-2"
                data-guest-links-browse-list
                data-tapbench-links-list
              >
                {filteredBrowseRows.map((row) => renderBrowseRow(row))}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
