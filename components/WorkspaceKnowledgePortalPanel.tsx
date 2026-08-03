"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useI18n } from "@/lib/i18n";
import {
  PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
  PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
  PRACTICE_PORTAL_PRODUCT_IDS,
  PRACTICE_PORTAL_TIMED_DRILL_OPTIONS,
  PRACTICE_PORTAL_TIMED_EXPLORE_OPTIONS,
  type PracticePortalConfig,
  type PracticePortalProductId,
  type PracticePortalScopeMode,
} from "@/lib/practice-portal";
import { PRODUCT_INTENT_LABELS } from "@/lib/product-intent";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";

interface WorkspaceBlock {
  id: string;
  title: string | null;
  is_start: boolean | null;
}

interface PracticePortalRow {
  id: string;
  workspace_id: string;
  status: string;
  config: PracticePortalConfig;
  label: string | null;
  created_at: string;
  revoked_at?: string | null;
  url?: string | null;
  public_token?: string | null;
}

const PRODUCT_CREATE_LABELS: Record<PracticePortalProductId, string> = {
  open_ended_explore: PRODUCT_INTENT_LABELS.openEndedExplore,
  open_ended_drill: PRODUCT_INTENT_LABELS.openEndedDrill,
  timed_explore: PRODUCT_INTENT_LABELS.timedExplore,
  timed_drill: PRODUCT_INTENT_LABELS.timedDrill,
};

type PortalInnerTab = "create" | "browse";

interface WorkspaceKnowledgePortalPanelProps {
  workspaceId: string;
  isOwner: boolean;
  currentUserId: string | null;
}

/**
 * Owner Settings: Knowledge Portal create + browse (Create / Browse subtabs).
 * Shareable mint desk for a single workspace — separate from TAP/ILE guest links.
 */
export function WorkspaceKnowledgePortalPanel({
  workspaceId,
  isOwner,
  currentUserId,
}: WorkspaceKnowledgePortalPanelProps) {
  const { t } = useI18n();
  const [innerTab, setInnerTab] = useState<PortalInnerTab>("create");
  const [blocks, setBlocks] = useState<WorkspaceBlock[]>([]);
  const [practicePortals, setPracticePortals] = useState<PracticePortalRow[]>([]);
  const [portalProducts, setPortalProducts] = useState<PracticePortalProductId[]>([
    ...PRACTICE_PORTAL_PRODUCT_IDS,
  ]);
  const [portalExploreMinutes, setPortalExploreMinutes] = useState<number[]>([
    ...PRACTICE_PORTAL_DEFAULT_TIMED_EXPLORE_MINUTES,
  ]);
  const [portalDrillMinutes, setPortalDrillMinutes] = useState<number[]>([
    ...PRACTICE_PORTAL_DEFAULT_TIMED_DRILL_MINUTES,
  ]);
  const [portalLabel, setPortalLabel] = useState("");
  /** visitor_pick | fixed_block | workspace — workspace forces no block choice. */
  const [portalScopeMode, setPortalScopeMode] =
    useState<PracticePortalScopeMode>("visitor_pick");
  const [portalBlockId, setPortalBlockId] = useState("");
  const [creatingPortal, setCreatingPortal] = useState(false);
  const [portalError, setPortalError] = useState<string | null>(null);
  const [linksLoading, setLinksLoading] = useState(false);
  const [invalidating, setInvalidating] = useState(false);
  const [copiedLinkId, setCopiedLinkId] = useState<string | null>(null);
  const [browseQuery, setBrowseQuery] = useState("");
  const [browseStatus, setBrowseStatus] = useState<string>("all");

  const fieldClass =
    "mt-1 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-white";
  const primaryBtnClass =
    "rounded-md bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40";

  const blockTitleById = useMemo(() => {
    return new Map(blocks.map((block) => [block.id, block.title || block.id]));
  }, [blocks]);

  const browseStatuses = useMemo(() => {
    const set = new Set<string>();
    for (const p of practicePortals) {
      if (p.status) set.add(p.status);
    }
    return Array.from(set).sort();
  }, [practicePortals]);

  const filteredPortals = useMemo(() => {
    const q = browseQuery.trim().toLowerCase();
    return practicePortals.filter((portal) => {
      if (browseStatus !== "all" && portal.status !== browseStatus) return false;
      if (!q) return true;
      const products = (portal.config?.allowed_products || []).join(" ");
      const hay = [
        portal.id,
        portal.label || "",
        portal.status,
        products,
        portal.config?.block_id || "",
        portal.config?.scope_mode || "",
        portal.url || "",
        portal.public_token || "",
      ]
        .join(" ")
        .toLowerCase();
      return hay.includes(q);
    });
  }, [browseQuery, browseStatus, practicePortals]);

  const loadPortals = useCallback(async () => {
    if (!currentUserId || !isOwner) return;
    setLinksLoading(true);
    setPortalError(null);
    try {
      const [portalRes] = await Promise.all([
        fetch(
          `/api/workspace/practice-portals?workspaceId=${encodeURIComponent(workspaceId)}`,
        ),
      ]);

      const portalData = await portalRes.json().catch(() => ({}));
      if (!portalRes.ok) {
        throw new Error(
          portalData.error || t("planView.practicePortalLoadError"),
        );
      }
      setPracticePortals(
        Array.isArray(portalData.practice_portals) ? portalData.practice_portals : [],
      );

      const { createClient } = await import("@/lib/supabase/client");
      const supabase = createClient();
      const { data: blockRows } = await supabase
        .from("blocks")
        .select("id, title, is_start")
        .eq("workspace_id", workspaceId)
        .order("created_at", { ascending: true });
      setBlocks(blockRows || []);
    } catch (error) {
      setPortalError(
        error instanceof Error ? error.message : t("planView.practicePortalLoadError"),
      );
    } finally {
      setLinksLoading(false);
    }
  }, [currentUserId, isOwner, t, workspaceId]);

  useEffect(() => {
    if (isOwner && currentUserId) {
      void loadPortals();
    }
  }, [currentUserId, isOwner, loadPortals]);

  const togglePortalProduct = useCallback(
    (id: PracticePortalProductId) => {
      // Workspace-level portals only support timed products (null block_id).
      if (
        portalScopeMode === "workspace" &&
        (id === "open_ended_explore" || id === "open_ended_drill")
      ) {
        return;
      }
      setPortalProducts((current) => {
        if (current.includes(id)) {
          if (current.length <= 1) return current;
          return current.filter((p) => p !== id);
        }
        return PRACTICE_PORTAL_PRODUCT_IDS.filter(
          (p) => p === id || current.includes(p),
        );
      });
    },
    [portalScopeMode],
  );

  const setScopeMode = useCallback((mode: PracticePortalScopeMode) => {
    setPortalScopeMode(mode);
    if (mode === "workspace") {
      setPortalBlockId("");
      // Drop open-ended products — ILE requires a block.
      setPortalProducts((current) => {
        const next = current.filter(
          (p) => p !== "open_ended_explore" && p !== "open_ended_drill",
        );
        return next.length > 0
          ? next
          : (["timed_explore", "timed_drill"] as PracticePortalProductId[]);
      });
    }
    if (mode === "visitor_pick") {
      setPortalBlockId("");
    }
  }, []);

  const togglePortalMinutes = useCallback(
    (kind: "explore" | "drill", mins: number) => {
      const setter = kind === "explore" ? setPortalExploreMinutes : setPortalDrillMinutes;
      setter((current) => {
        if (current.includes(mins)) {
          if (current.length <= 1) return current;
          return current.filter((m) => m !== mins).sort((a, b) => a - b);
        }
        return [...current, mins].sort((a, b) => a - b);
      });
    },
    [],
  );

  const createPracticePortal = useCallback(async () => {
    setCreatingPortal(true);
    setPortalError(null);
    try {
      if (portalProducts.length === 0) {
        throw new Error(t("planView.practicePortalCreateError"));
      }
      if (portalScopeMode === "fixed_block" && !portalBlockId) {
        throw new Error(t("planView.practicePortalBlockRequired"));
      }
      const config = {
        allowed_products: portalProducts,
        timings: {
          timed_explore: portalProducts.includes("timed_explore")
            ? portalExploreMinutes
            : [],
          timed_drill: portalProducts.includes("timed_drill") ? portalDrillMinutes : [],
        },
        scope_mode: portalScopeMode,
        block_id:
          portalScopeMode === "fixed_block" && portalBlockId
            ? portalBlockId
            : null,
      };
      const response = await fetch("/api/workspace/practice-portals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          config,
          label: portalLabel.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || t("planView.practicePortalCreateError"));
      }
      setPortalLabel("");
      await loadPortals();
      setInnerTab("browse");
    } catch (error) {
      setPortalError(
        error instanceof Error ? error.message : t("planView.practicePortalCreateError"),
      );
    } finally {
      setCreatingPortal(false);
    }
  }, [
    loadPortals,
    portalBlockId,
    portalDrillMinutes,
    portalExploreMinutes,
    portalLabel,
    portalProducts,
    portalScopeMode,
    t,
    workspaceId,
  ]);

  const invalidatePracticePortal = useCallback(
    async (portalId: string) => {
      if (!window.confirm(t("planView.practicePortalInvalidateConfirm"))) return;
      setInvalidating(true);
      setPortalError(null);
      try {
        const response = await fetch("/api/workspace/practice-portals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ workspaceId, invalidate_portal_id: portalId }),
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || t("planView.practicePortalInvalidateError"));
        }
        await loadPortals();
      } catch (error) {
        setPortalError(
          error instanceof Error
            ? error.message
            : t("planView.practicePortalInvalidateError"),
        );
      } finally {
        setInvalidating(false);
      }
    },
    [loadPortals, t, workspaceId],
  );

  const copyLink = useCallback(
    async (linkId: string, url: string) => {
      try {
        await navigator.clipboard.writeText(url);
        setCopiedLinkId(linkId);
        window.setTimeout(() => setCopiedLinkId(null), 2000);
      } catch {
        setPortalError(t("planView.practicePortalCreateError"));
      }
    },
    [t],
  );

  const portalUrl = useCallback((portal: PracticePortalRow): string | undefined => {
    if (portal.status === "revoked") return undefined;
    if (portal.url) return portal.url;
    if (portal.public_token && typeof window !== "undefined") {
      return `${window.location.origin}/portal/${portal.public_token}`;
    }
    return undefined;
  }, []);

  if (!isOwner || !currentUserId) {
    return (
      <section
        className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 p-5 backdrop-blur-md sm:p-6"
        data-settings-section="knowledge-portal"
        data-knowledge-portal-panel
      >
        <p className="text-xs text-neutral-500">{t("planView.tapIleLinksOwnerOnly")}</p>
      </section>
    );
  }

  const innerTabs = [
    { id: "create" as const, label: t("planView.knowledgePortalTabCreate") },
    { id: "browse" as const, label: t("planView.knowledgePortalTabBrowse") },
  ];

  return (
    <div
      className="flex w-full flex-col gap-0"
      data-settings-section="knowledge-portal"
      data-knowledge-portal-panel
    >
      <div
        className="rounded-xl border border-neutral-800/80 bg-neutral-950/75 backdrop-blur-md"
        data-knowledge-portal-inner-tabs
      >
        <WorkspaceSectionSubTabs
          activeId={innerTab}
          onChange={setInnerTab}
          tabs={innerTabs}
          ariaLabel={t("planView.knowledgePortalInnerTabsAria")}
        />

        {innerTab === "create" ? (
          <div
            className="flex flex-col gap-5 p-5 sm:p-6"
            data-knowledge-portal-inner-tab="create"
            data-practice-portal
            data-practice-portal-create
            data-product-intent="practice-portal-create"
            role="tabpanel"
          >
            <div>
              <h3 className="text-sm font-medium text-white">
                {t("planView.practicePortalTitle")}
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                {t("planView.practicePortalHint")}
              </p>
            </div>

            <label className="block text-xs text-neutral-400">
              {t("planView.practicePortalLabel")}
              <input
                type="text"
                value={portalLabel}
                onChange={(e) => setPortalLabel(e.target.value)}
                placeholder={t("planView.practicePortalLabelPlaceholder")}
                className={fieldClass}
                data-practice-portal-label
              />
            </label>

            <fieldset
              className="space-y-2"
              data-practice-portal-scope
              data-practice-portal-scope-control
            >
              <legend className="text-xs text-neutral-400">
                {t("planView.practicePortalScope")}
              </legend>
              <p className="text-[10px] leading-relaxed text-neutral-500">
                {t("planView.practicePortalScopeHint")}
              </p>
              {(
                [
                  {
                    mode: "visitor_pick" as const,
                    labelKey: "planView.practicePortalScopeVisitor" as const,
                    descKey: "planView.practicePortalScopeVisitorDesc" as const,
                    dataAttr: "data-practice-portal-scope-visitor",
                  },
                  {
                    mode: "fixed_block" as const,
                    labelKey: "planView.practicePortalScopeFixed" as const,
                    descKey: "planView.practicePortalScopeFixedDesc" as const,
                    dataAttr: "data-practice-portal-scope-fixed",
                  },
                  {
                    mode: "workspace" as const,
                    labelKey: "planView.practicePortalScopeWorkspace" as const,
                    descKey: "planView.practicePortalScopeWorkspaceDesc" as const,
                    dataAttr: "data-practice-portal-scope-workspace",
                  },
                ] as const
              ).map((opt) => {
                const selected = portalScopeMode === opt.mode;
                return (
                  <label
                    key={opt.mode}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-xs transition ${
                      selected
                        ? "border-white bg-white/5 text-white"
                        : "border-neutral-700 bg-neutral-900 text-neutral-400"
                    }`}
                    data-practice-portal-scope-option={opt.mode}
                    {...{ [opt.dataAttr]: true }}
                  >
                    <input
                      type="radio"
                      name="practice-portal-scope"
                      className="mt-0.5"
                      checked={selected}
                      onChange={() => setScopeMode(opt.mode)}
                      data-practice-portal-scope-radio={opt.mode}
                    />
                    <span>
                      <span className="block font-medium text-neutral-100">
                        {t(opt.labelKey)}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-neutral-500">
                        {t(opt.descKey)}
                      </span>
                    </span>
                  </label>
                );
              })}
            </fieldset>

            {portalScopeMode === "fixed_block" ? (
              <label
                className="block text-xs text-neutral-400"
                data-practice-portal-block
              >
                {t("planView.practicePortalBlock")}
                <select
                  value={portalBlockId}
                  onChange={(e) => setPortalBlockId(e.target.value)}
                  className={fieldClass}
                  data-practice-portal-block-select
                >
                  <option value="">
                    {t("planView.practicePortalBlockSelectPlaceholder")}
                  </option>
                  {blocks.map((block) => (
                    <option key={block.id} value={block.id}>
                      {block.title || block.id}
                      {block.is_start ? " (start)" : ""}
                    </option>
                  ))}
                </select>
                <span className="mt-1 block text-[10px] text-neutral-500">
                  {t("planView.practicePortalBlockHint")}
                </span>
              </label>
            ) : null}

            {portalScopeMode === "workspace" ? (
              <p
                className="rounded-md border border-neutral-800 bg-neutral-900/60 px-3 py-2 text-[11px] leading-relaxed text-neutral-500"
                data-practice-portal-workspace-scope-note
              >
                {t("planView.practicePortalScopeWorkspaceNote")}
              </p>
            ) : null}

            <fieldset data-practice-portal-products>
              <legend className="text-xs text-neutral-400">
                {t("planView.practicePortalProducts")}
              </legend>
              <div className="mt-2 grid gap-2 sm:grid-cols-2">
                {PRACTICE_PORTAL_PRODUCT_IDS.map((id) => {
                  const checked = portalProducts.includes(id);
                  const openEndedDisabled =
                    portalScopeMode === "workspace" &&
                    (id === "open_ended_explore" || id === "open_ended_drill");
                  return (
                    <label
                      key={id}
                      className={`flex cursor-pointer items-start gap-2.5 rounded-md border px-3 py-2 text-xs transition ${
                        openEndedDisabled
                          ? "cursor-not-allowed border-neutral-800 bg-neutral-950 text-neutral-600 opacity-60"
                          : checked
                            ? "border-white bg-white/5 text-white"
                            : "border-neutral-700 bg-neutral-900 text-neutral-400"
                      }`}
                      data-practice-portal-product={id}
                      data-practice-portal-product-disabled={
                        openEndedDisabled ? "true" : undefined
                      }
                    >
                      <input
                        type="checkbox"
                        className="mt-0.5 rounded border-neutral-700 bg-neutral-900"
                        checked={checked && !openEndedDisabled}
                        disabled={openEndedDisabled}
                        onChange={() => togglePortalProduct(id)}
                      />
                      <span className="font-medium">{PRODUCT_CREATE_LABELS[id]}</span>
                    </label>
                  );
                })}
              </div>
            </fieldset>

            {portalProducts.includes("timed_explore") ? (
              <fieldset data-practice-portal-timings-explore>
                <legend className="text-xs text-neutral-400">
                  {t("planView.practicePortalTimingsExplore")}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRACTICE_PORTAL_TIMED_EXPLORE_OPTIONS.map((mins) => {
                    const checked = portalExploreMinutes.includes(mins);
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => togglePortalMinutes("explore", mins)}
                        className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition ${
                          checked
                            ? "border-white bg-white text-black"
                            : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
                        }`}
                        data-practice-portal-timing-explore={mins}
                        aria-pressed={checked}
                      >
                        {mins} min
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            {portalProducts.includes("timed_drill") ? (
              <fieldset data-practice-portal-timings-drill>
                <legend className="text-xs text-neutral-400">
                  {t("planView.practicePortalTimingsDrill")}
                </legend>
                <div className="mt-2 flex flex-wrap gap-2">
                  {PRACTICE_PORTAL_TIMED_DRILL_OPTIONS.map((mins) => {
                    const checked = portalDrillMinutes.includes(mins);
                    return (
                      <button
                        key={mins}
                        type="button"
                        onClick={() => togglePortalMinutes("drill", mins)}
                        className={`rounded-md border px-2.5 py-1.5 font-mono text-[11px] transition ${
                          checked
                            ? "border-white bg-white text-black"
                            : "border-neutral-700 bg-neutral-900 text-neutral-400 hover:border-neutral-500"
                        }`}
                        data-practice-portal-timing-drill={mins}
                        aria-pressed={checked}
                      >
                        {mins} min
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            ) : null}

            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                disabled={creatingPortal || portalProducts.length === 0}
                onClick={() => void createPracticePortal()}
                className={primaryBtnClass}
                data-practice-portal-create-submit
              >
                {creatingPortal
                  ? t("planView.practicePortalCreating")
                  : t("planView.practicePortalCreate")}
              </button>
            </div>

            {portalError ? (
              <p className="text-xs text-red-400" data-practice-portal-error>
                {portalError}
              </p>
            ) : null}
          </div>
        ) : null}

        {innerTab === "browse" ? (
          <div
            className="flex flex-col gap-4 p-5 sm:p-6"
            data-knowledge-portal-inner-tab="browse"
            data-practice-portal-list
            role="tabpanel"
          >
            <div>
              <h3 className="text-sm font-medium text-white">
                {t("planView.knowledgePortalBrowseTitle")}
              </h3>
              <p className="mt-1 max-w-2xl text-xs leading-relaxed text-neutral-500">
                {t("planView.knowledgePortalBrowseHint")}
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block text-xs text-neutral-400">
                {t("planView.knowledgePortalSearchLabel")}
                <input
                  type="search"
                  value={browseQuery}
                  onChange={(e) => setBrowseQuery(e.target.value)}
                  placeholder={t("planView.knowledgePortalSearchPlaceholder")}
                  className={fieldClass}
                  data-knowledge-portal-search
                />
              </label>
              <label className="block text-xs text-neutral-400">
                {t("planView.knowledgePortalFilterStatus")}
                <select
                  value={browseStatus}
                  onChange={(e) => setBrowseStatus(e.target.value)}
                  className={fieldClass}
                  data-knowledge-portal-filter-status
                >
                  <option value="all">
                    {t("planView.knowledgePortalFilterStatusAll")}
                  </option>
                  {browseStatuses.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <p className="text-xs text-neutral-500">
              {t("planView.knowledgePortalBrowseCount")
                .replace("{shown}", String(filteredPortals.length))
                .replace("{total}", String(practicePortals.length))}
            </p>

            {portalError ? (
              <p className="text-xs text-red-400" data-practice-portal-error>
                {portalError}
              </p>
            ) : null}

            {linksLoading ? (
              <LoadingStatusMessage
                size="sm"
                tone="subtle"
                message={t("planView.practicePortalCreating")}
              />
            ) : practicePortals.length === 0 ? (
              <p className="text-xs text-neutral-600">
                {t("planView.practicePortalEmpty")}
              </p>
            ) : filteredPortals.length === 0 ? (
              <p className="text-xs text-neutral-600">
                {t("planView.knowledgePortalBrowseNoMatches")}
              </p>
            ) : (
              <ul className="flex flex-col gap-2" data-knowledge-portal-browse-list>
                {filteredPortals.map((portal) => {
                  const isRevoked = portal.status === "revoked";
                  const url = portalUrl(portal);
                  const productSummary = (
                    portal.config?.allowed_products || []
                  ).join(", ");
                  const scopeMode = portal.config?.scope_mode || "visitor_pick";
                  const fixedBlock =
                    scopeMode === "fixed_block" &&
                    portal.config?.block_id &&
                    (blockTitleById.get(portal.config.block_id) ||
                      portal.config.block_id.slice(0, 8));
                  const scopeLabel =
                    scopeMode === "workspace"
                      ? "workspace"
                      : fixedBlock
                        ? `block: ${fixedBlock}`
                        : "visitor pick";
                  return (
                    <li
                      key={portal.id}
                      className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-neutral-800 px-3 py-2 text-xs"
                      data-practice-portal-row={portal.id}
                      data-practice-portal-status={portal.status}
                      data-practice-portal-scope-mode={scopeMode}
                    >
                      <div className="min-w-0 text-neutral-400">
                        <p className="text-neutral-300">
                          {portal.label || t("planView.practicePortalTitle")}
                          {isRevoked ? (
                            <span className="ml-2 text-red-400/90">
                              ({t("planView.practicePortalRevoked")})
                            </span>
                          ) : null}
                        </p>
                        <p className="mt-0.5 truncate text-[10px] text-neutral-500">
                          {productSummary || "—"}
                          {` · ${scopeLabel}`}
                        </p>
                        <p className="font-mono text-[10px] text-neutral-600">
                          {portal.id}
                        </p>
                        {url ? (
                          <p
                            className="mt-1 break-all font-mono text-[10px] text-sky-400/80"
                            data-practice-portal-url={portal.id}
                          >
                            {url}
                          </p>
                        ) : null}
                      </div>
                      <div className="flex shrink-0 flex-wrap items-center gap-2">
                        {url ? (
                          <button
                            type="button"
                            onClick={() => void copyLink(portal.id, url)}
                            className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-xs text-white transition hover:border-neutral-400"
                            data-practice-portal-copy={portal.id}
                          >
                            {copiedLinkId === portal.id
                              ? t("planView.practicePortalCopied")
                              : t("planView.practicePortalCopy")}
                          </button>
                        ) : null}
                        {!isRevoked ? (
                          <button
                            type="button"
                            disabled={invalidating || creatingPortal}
                            onClick={() => void invalidatePracticePortal(portal.id)}
                            className="rounded-md border border-red-900/60 px-2.5 py-1.5 text-xs text-red-300 transition hover:border-red-700 disabled:opacity-40"
                            data-practice-portal-invalidate={portal.id}
                          >
                            {t("planView.practicePortalInvalidate")}
                          </button>
                        ) : null}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
