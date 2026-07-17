"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";
import type { TapPostSessionMode } from "@/lib/agent-v2/tap-link-config";
import { TAP_LINK_DEFAULT_MINUTES, TAP_LINK_MAX_MINUTES, TAP_LINK_MIN_MINUTES } from "@/lib/agent-v2/tap-link-config";
import { PerformanceChat } from "@/components/PerformanceChat";
import { PerformanceReportCard } from "@/components/PerformanceReportCard";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

type PerformanceSubview = "score" | "tap" | "chat";

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

interface OrgMember {
  id: string;
  email: string | null;
  username: string | null;
}

interface WorkspacePerformancePanelProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
  isGroupPlan?: boolean;
  hideTap?: boolean;
  ayclToken?: string;
}

function PerformanceSubviewTabs({
  activeSubview,
  onChange,
  tabs,
}: {
  activeSubview: PerformanceSubview;
  onChange: (tab: PerformanceSubview) => void;
  tabs: Array<{ id: PerformanceSubview; label: string }>;
}) {
  const { t } = useI18n();

  return (
    <div className="shrink-0 border-b border-neutral-800/80 px-4 md:px-6">
      <div
        className="-mb-px flex gap-1 overflow-x-auto pb-px [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        role="tablist"
        aria-label={t("planView.performanceSectionsAriaLabel")}
      >
        {tabs.map((tab) => {
          const isActive = activeSubview === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange(tab.id)}
              className={`flex shrink-0 items-center gap-2 border-b-2 px-3 py-2.5 text-left transition ${
                isActive
                  ? "border-white text-white"
                  : "border-transparent text-neutral-500 hover:border-neutral-600 hover:text-neutral-300"
              }`}
            >
              <span className="whitespace-nowrap text-xs font-medium">{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function participantLabel(link: TapLinkRow, t: (key: string) => string) {
  if (link.participant_type === "anonymous") return t("planView.tapLinksParticipantAnonymous");
  if (link.participant_type === "user" || link.assigned_user_id) return t("planView.tapLinksParticipantMember");
  if (link.participant_type === "guest" || link.guest_user_id) return t("planView.tapLinksParticipantGuest");
  return "—";
}

export function WorkspacePerformancePanel({
  workspaceId,
  isOwner,
  currentUserId,
  isGroupPlan = false,
  hideTap = false,
  ayclToken,
}: WorkspacePerformancePanelProps) {
  const { t } = useI18n();
  const [activeSubview, setActiveSubview] = useState<PerformanceSubview>("score");
  const [report, setReport] = useState<PerformanceReport | null>(null);
  const [loadingReport, setLoadingReport] = useState(false);
  const [reportError, setReportError] = useState<string | null>(null);

  const [blocks, setBlocks] = useState<WorkspaceBlock[]>([]);
  const [tapLinks, setTapLinks] = useState<TapLinkRow[]>([]);
  const [orgMembers, setOrgMembers] = useState<OrgMember[]>([]);
  /** Empty string = entire workspace; UUID = that block. */
  const [selectedBlockId, setSelectedBlockId] = useState("");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [minutes, setMinutes] = useState(TAP_LINK_DEFAULT_MINUTES);
  const [postSession, setPostSession] = useState<TapPostSessionMode>("redirect_workspace");
  const [redirectUrl, setRedirectUrl] = useState("");
  const [linksLoading, setLinksLoading] = useState(false);
  const [linksError, setLinksError] = useState<string | null>(null);
  const [creatingLink, setCreatingLink] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [createdLinks, setCreatedLinks] = useState<Record<string, string>>({});

  const subTabs: Array<{ id: PerformanceSubview; label: string }> = [
    { id: "score", label: t("planView.performanceSubTabScore") },
    ...(hideTap ? [] : [{ id: "tap" as const, label: t("planView.performanceSubTabTap") }]),
    { id: "chat", label: t("planView.performanceSubTabChat") },
  ];

  const blockTitleById = useMemo(() => {
    return new Map(blocks.map((block) => [block.id, block.title || block.id]));
  }, [blocks]);

  const loadTapResources = useCallback(async () => {
    if (!currentUserId || !isOwner) return;
    setLinksLoading(true);
    setLinksError(null);
    try {
      const [linksRes, orgRes] = await Promise.all([
        fetch(`/api/workspace/tap-links?workspaceId=${encodeURIComponent(workspaceId)}`),
        fetch("/api/organization"),
      ]);

      const linksData = await linksRes.json();
      if (!linksRes.ok) throw new Error(linksData.error || t("planView.tapLinksLoadError"));

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: blockRows } = await supabase
        .from("blocks")
        .select("id, title, is_start")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });

      setBlocks(blockRows || []);
      setTapLinks(linksData.tap_links || []);

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
            }))
        );
      }
    } catch (error) {
      setLinksError(error instanceof Error ? error.message : t("planView.tapLinksLoadError"));
    } finally {
      setLinksLoading(false);
    }
  }, [currentUserId, isOwner, t, workspaceId]);

  useEffect(() => {
    if (hideTap && activeSubview === "tap") {
      setActiveSubview("score");
    }
  }, [activeSubview, hideTap]);

  useEffect(() => {
    if (activeSubview === "tap" && isOwner) {
      void loadTapResources();
    }
  }, [activeSubview, isOwner, loadTapResources]);

  const generateScore = useCallback(async () => {
    if (!currentUserId) return;
    setLoadingReport(true);
    setReportError(null);
    try {
      const response = await fetch("/api/workspace/performance-report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, ...(ayclToken ? { ayclToken } : {}) }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to generate score");
      setReport(data.report);
    } catch (error) {
      setReportError(error instanceof Error ? error.message : "Failed to generate score");
    } finally {
      setLoadingReport(false);
    }
  }, [ayclToken, currentUserId, workspaceId]);

  const createTapLink = useCallback(
    async (participantType: "anonymous" | "user") => {
      setCreatingLink(true);
      setCreateError(null);
      try {
        const body: Record<string, unknown> = {
          workspaceId,
          minutes,
          participant_type: participantType,
          post_session: postSession,
        };
        if (selectedBlockId) {
          body.blockId = selectedBlockId;
        }
        if (postSession === "redirect_url") {
          body.redirect_url = redirectUrl.trim();
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

        const privateUrl = data.tap_link?.private_url as string | undefined;
        if (privateUrl && data.tap_link?.id) {
          setCreatedLinks((current) => ({ ...current, [data.tap_link.id]: privateUrl }));
        }
        await loadTapResources();
      } catch (error) {
        setCreateError(error instanceof Error ? error.message : t("planView.tapLinksCreateError"));
      } finally {
        setCreatingLink(false);
      }
    },
    [
      loadTapResources,
      minutes,
      postSession,
      redirectUrl,
      selectedBlockId,
      selectedMemberId,
      t,
      workspaceId,
    ]
  );

  const copyLink = useCallback(async (linkId: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedLinkId(linkId);
      window.setTimeout(() => setCopiedLinkId(null), 2000);
    } catch {
      setCreateError(t("planView.tapLinksCreateError"));
    }
  }, [t]);

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <PerformanceSubviewTabs activeSubview={activeSubview} onChange={setActiveSubview} tabs={subTabs} />

      <div className="flex min-h-0 flex-1 flex-col p-4 md:p-6">
        {activeSubview === "score" && (
          <section className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex shrink-0 flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-sm font-medium text-white">{t("planView.performanceScoreTitle")}</h2>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                  {t("planView.performanceScoreHint")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => void generateScore()}
                disabled={!currentUserId || loadingReport}
                className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
              >
                {loadingReport ? t("planView.performanceScoreGenerating") : t("planView.performanceScoreGenerate")}
              </button>
            </div>
            {reportError && <p className="mt-3 shrink-0 text-xs text-red-400">{reportError}</p>}
            {loadingReport && !report ? (
              <div className="mt-6">
                <LoadingStatusMessage tone="subtle" message={t("planView.performanceScoreGenerating")} />
              </div>
            ) : null}
            {report ? (
              <div className="mt-4 min-h-0 flex-1 rounded-lg border border-neutral-800 bg-neutral-950/50 p-4 md:p-5">
                <PerformanceReportCard
                  report={report}
                  layout="spacious"
                  fillHeight
                  label={t("planView.performanceScoreTitle")}
                />
              </div>
            ) : null}
          </section>
        )}

        {activeSubview === "tap" && (
          <section className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-8 overflow-y-auto">
            <div>
              <h2 className="text-sm font-medium text-white">{t("planView.productTap")}</h2>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">{t("planView.productTapHint")}</p>
              {currentUserId ? (
                <Link
                  href={`/workspace/${workspaceId}/tap`}
                  className="mt-4 inline-flex w-fit rounded-md bg-white px-4 py-2.5 text-xs font-medium text-black transition hover:bg-neutral-200"
                >
                  {t("planView.startTap")}
                </Link>
              ) : (
                <p className="mt-4 text-xs text-neutral-600">{t("planView.signInForTap")}</p>
              )}
            </div>

            {isOwner && currentUserId ? (
              <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-4 md:p-5">
                <h3 className="text-sm font-medium text-white">{t("planView.tapLinksTitle")}</h3>
                <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">{t("planView.tapLinksHint")}</p>

                <div className="mt-4 grid gap-4 sm:grid-cols-2">
                  <label className="block text-xs text-neutral-400">
                    {t("planView.tapLinksScope")}
                    <select
                      value={selectedBlockId}
                      onChange={(event) => setSelectedBlockId(event.target.value)}
                      className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
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
                      onChange={(event) => setMinutes(Number(event.target.value) || TAP_LINK_DEFAULT_MINUTES)}
                      className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                    />
                  </label>

                  <label className="block text-xs text-neutral-400 sm:col-span-2">
                    {t("planView.tapLinksPostSession")}
                    <select
                      value={postSession}
                      onChange={(event) => setPostSession(event.target.value as TapPostSessionMode)}
                      className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                    >
                      <option value="redirect_workspace">{t("planView.tapLinksPostSessionRedirectWorkspace")}</option>
                      <option value="show_results">{t("planView.tapLinksPostSessionShowResults")}</option>
                      <option value="redirect_url">{t("planView.tapLinksPostSessionRedirectUrl")}</option>
                    </select>
                  </label>

                  {postSession === "redirect_url" ? (
                    <label className="block text-xs text-neutral-400 sm:col-span-2">
                      {t("planView.tapLinksRedirectUrl")}
                      <input
                        type="url"
                        value={redirectUrl}
                        onChange={(event) => setRedirectUrl(event.target.value)}
                        placeholder="https://"
                        className="mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white"
                      />
                    </label>
                  ) : null}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={creatingLink}
                    onClick={() => void createTapLink("anonymous")}
                    className="rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
                  >
                    {creatingLink ? t("planView.tapLinksCreating") : t("planView.tapLinksCreateAnonymous")}
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
                            {member.username || member.email || member.id}
                          </option>
                        ))}
                      </select>
                      <button
                        type="button"
                        disabled={creatingLink || !selectedMemberId}
                        onClick={() => void createTapLink("user")}
                        className="rounded-md border border-neutral-600 px-3 py-2 text-xs font-medium text-white transition hover:border-neutral-400 disabled:opacity-40"
                      >
                        {creatingLink ? t("planView.tapLinksCreating") : t("planView.tapLinksCreateMember")}
                      </button>
                    </>
                  ) : null}
                </div>

                {createError ? <p className="mt-3 text-xs text-red-400">{createError}</p> : null}
                {linksError ? <p className="mt-3 text-xs text-red-400">{linksError}</p> : null}

                <div className="mt-6">
                  <h4 className="text-xs font-medium uppercase tracking-wide text-neutral-500">
                    {t("planView.tapLinksListTitle")}
                  </h4>
                  {linksLoading ? (
                    <div className="mt-3">
                      <LoadingStatusMessage size="sm" tone="subtle" message={t("planView.tapLinksCreating")} />
                    </div>
                  ) : tapLinks.length === 0 ? (
                    <p className="mt-3 text-xs text-neutral-600">{t("planView.tapLinksEmpty")}</p>
                  ) : (
                    <ul className="mt-3 space-y-2">
                      {tapLinks.map((link) => {
                        const privateUrl = createdLinks[link.id];
                        const scopeLabel = link.block_id
                          ? blockTitleById.get(link.block_id) || link.block_id
                          : t("planView.tapLinksEntireWorkspace");
                        return (
                          <li
                            key={link.id}
                            className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-800 px-3 py-2 text-xs"
                          >
                            <div className="min-w-0 text-neutral-400">
                              <p className="text-neutral-300">
                                {t("planView.tapLinksStatus")}: {link.status}
                              </p>
                              <p>
                                {t("planView.tapLinksScope")}: {scopeLabel}
                              </p>
                              <p>
                                {t("planView.tapLinksParticipant")}: {participantLabel(link, t)}
                              </p>
                              <p>{Math.round(link.requested_duration_seconds / 60)} min · {link.post_session}</p>
                            </div>
                            {privateUrl ? (
                              <button
                                type="button"
                                onClick={() => void copyLink(link.id, privateUrl)}
                                className="shrink-0 rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs text-white transition hover:border-neutral-400"
                              >
                                {copiedLinkId === link.id ? t("planView.tapLinksCopied") : t("planView.tapLinksCopy")}
                              </button>
                            ) : null}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
            ) : null}
          </section>
        )}

        {activeSubview === "chat" && (
          <section className="flex min-h-0 flex-1 flex-col">
            <div className="min-h-0 flex-1">
              <PerformanceChat
                workspaceId={workspaceId}
                isOwner={isOwner}
                currentUserId={currentUserId}
                isGroupPlan={isGroupPlan}
                compact
                ayclToken={ayclToken}
              />
            </div>
          </section>
        )}
      </div>
    </div>
  );
}