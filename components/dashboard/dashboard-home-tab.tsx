"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BlockSkillGrid } from "@/components/BlockSkillGrid";
import type { Workspace } from "@/lib/storage";
import { dashboardHasNoWorkspaces } from "@/lib/dashboard-workspace-filters";
import {
  DASHBOARD_PLAY_CURIOUS_PATH,
  DASHBOARD_PLAY_START_PATH,
  dashboardPlayKindLabel,
  normalizeDashboardPlayPrompt,
  type DashboardPlayKind,
} from "@/lib/dashboard-play";
import {
  dashboardPlayKindsForAccess,
  formatFreeWeekReset,
  freeWeeklySessionLimitMessage,
} from "@/lib/free-tier";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import {
  DASHBOARD_CATALOG_PATH,
  DASHBOARD_MAPS_ADD_PATH,
  DASHBOARD_MAPS_TRY_PATH,
  collectPublicMapCategories,
  filterPublicMapCatalog,
  partitionPublicMapCatalog,
  truncatePublicMapSummary,
  type PublicMapCatalogItem,
} from "@/lib/dashboard-home-catalog";
import {
  dashboardMapBuyCheckoutBody,
  playCopyMyMapsHref,
} from "@/lib/workspace-play-copy";
import type { AyclLandingSummary } from "@/lib/aycl-landing";
import type { SkillGridNode } from "@/lib/block-skill-grid";

export type DashboardHomeTabProps = {
  workspaces: Workspace[];
  t: (key: string, params?: Record<string, string | number>) => string;
  hasPaidAccess?: boolean;
  weeklySessionsUsed?: number;
  weeklySessionsLimit?: number | null;
  weeklySessionsResetAt?: string | null;
  weeklySessionsAllowed?: boolean;
  coverImagePool?: readonly string[] | null;
};

type CatalogDetail = {
  map: PublicMapCatalogItem;
  landing: AyclLandingSummary | null;
};

export function DashboardHomeTab({
  workspaces,
  t,
  hasPaidAccess = false,
  weeklySessionsUsed = 0,
  weeklySessionsLimit = null,
  weeklySessionsResetAt = null,
  weeklySessionsAllowed = true,
  coverImagePool = null,
}: DashboardHomeTabProps) {
  const router = useRouter();
  const playKinds = useMemo(
    () => dashboardPlayKindsForAccess(hasPaidAccess),
    [hasPaidAccess],
  );
  const [kind, setKind] = useState<DashboardPlayKind>("learn");
  const [busy, setBusy] = useState<"start" | "curious" | false>(false);
  const [error, setError] = useState("");
  const [maps, setMaps] = useState<PublicMapCatalogItem[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
  const [heroIndex, setHeroIndex] = useState(0);
  const [detail, setDetail] = useState<CatalogDetail | null>(null);
  const [detailBusy, setDetailBusy] = useState(false);
  const [detailError, setDetailError] = useState("");
  const [acquireBusy, setAcquireBusy] = useState(false);
  const [tryBusy, setTryBusy] = useState(false);

  const emptyWorkspaces = dashboardHasNoWorkspaces(workspaces);
  const canStart = useMemo(
    () => Boolean(normalizeDashboardPlayPrompt(query)) && weeklySessionsAllowed,
    [query, weeklySessionsAllowed],
  );

  useEffect(() => {
    if (!playKinds.includes(kind)) setKind(playKinds[0] || "learn");
  }, [kind, playKinds]);

  useEffect(() => {
    let cancelled = false;
    setCatalogLoading(true);
    fetch("/api/dashboard/catalog" satisfies typeof DASHBOARD_CATALOG_PATH)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const next = Array.isArray(payload?.maps) ? payload.maps : [];
        setMaps(next);
      })
      .catch(() => {
        if (!cancelled) setMaps([]);
      })
      .finally(() => {
        if (!cancelled) setCatalogLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(
    () => filterPublicMapCatalog(maps, { query, category }),
    [maps, query, category],
  );
  const categories = useMemo(() => collectPublicMapCategories(maps), [maps]);
  const parts = useMemo(() => partitionPublicMapCatalog(filtered), [filtered]);

  useEffect(() => {
    setHeroIndex(0);
  }, [query, category, parts.hero.length]);

  const hero = parts.hero[heroIndex] || parts.hero[0] || null;
  const heroSummary = hero ? truncatePublicMapSummary(hero.summary, 320) : "";

  async function assertSessionQuota(
    report: (message: string) => void = setError,
  ): Promise<boolean> {
    const usageRes = await fetch("/api/check-usage");
    if (!usageRes.ok) return true;
    const usage = await usageRes.json();
    const freeAccount = usage.freeTier === true || usage.hasPaidAccess === false;
    if (freeAccount && usage.weeklySessionsAllowed === false) {
      report(freeWeeklySessionLimitMessage(usage.weeklySessionsResetAt || new Date()));
      return false;
    }
    if (!freeAccount && usage.allowed === false) {
      report(t("problemInput.sessionLimitReached"));
      return false;
    }
    return true;
  }

  async function startPlay() {
    const trimmed = normalizeDashboardPlayPrompt(query);
    if (!trimmed || busy) return;
    setBusy("start");
    setError("");
    try {
      if (!(await assertSessionQuota())) return;
      const response = await fetch(DASHBOARD_PLAY_START_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.href) {
        throw new Error(errorMessageFromBody(payload, "Could not start session"));
      }
      router.push(String(payload.href));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setBusy(false);
    }
  }

  async function startCurious() {
    if (busy) return;
    setBusy("curious");
    setError("");
    try {
      if (!(await assertSessionQuota())) return;
      const response = await fetch("/api/play/curious" satisfies typeof DASHBOARD_PLAY_CURIOUS_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ seed: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}` }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.href) {
        throw new Error(errorMessageFromBody(payload, "Could not invent a topic"));
      }
      if (typeof payload.prompt === "string" && payload.prompt.trim()) {
        setQuery(payload.prompt);
      }
      router.push(String(payload.href));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not invent a topic");
    } finally {
      setBusy(false);
    }
  }

  async function openDetail(item: PublicMapCatalogItem) {
    setDetail({ map: item, landing: null });
    setDetailError("");
    setDetailBusy(true);
    try {
      const res = await fetch(
        `${"/api/dashboard/catalog" satisfies typeof DASHBOARD_CATALOG_PATH}/${encodeURIComponent(item.id)}`,
      );
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not load map"));
      }
      setDetail({
        map: payload.map || item,
        landing: payload.landing || null,
      });
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Could not load map");
    } finally {
      setDetailBusy(false);
    }
  }

  async function tryNow(item: PublicMapCatalogItem) {
    if (acquireBusy || tryBusy || detailBusy) return;
    setTryBusy(true);
    setDetailError("");
    try {
      if (!(await assertSessionQuota(setDetailError))) return;
      const res = await fetch("/api/dashboard/maps/try" satisfies typeof DASHBOARD_MAPS_TRY_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: item.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.href) {
        throw new Error(errorMessageFromBody(payload, "Could not start session"));
      }
      router.push(String(payload.href));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setTryBusy(false);
    }
  }

  async function addToMyMaps(item: PublicMapCatalogItem) {
    if (acquireBusy || tryBusy) return;
    setAcquireBusy(true);
    setDetailError("");
    try {
      const res = await fetch("/api/dashboard/maps/add" satisfies typeof DASHBOARD_MAPS_ADD_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId: item.id }),
      });
      const payload = await res.json().catch(() => ({}));
      if (res.status === 402) {
        await buyMap(item);
        return;
      }
      if (!res.ok) {
        throw new Error(errorMessageFromBody(payload, "Could not add map"));
      }
      router.push(String(payload.href || playCopyMyMapsHref()));
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Could not add map");
    } finally {
      setAcquireBusy(false);
    }
  }

  async function buyMap(item: PublicMapCatalogItem) {
    if (tryBusy) return;
    setAcquireBusy(true);
    setDetailError("");
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dashboardMapBuyCheckoutBody(item.id)),
      });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok || !payload.url) {
        throw new Error(errorMessageFromBody(payload, "Checkout failed"));
      }
      window.location.href = String(payload.url);
    } catch (err) {
      setDetailError(err instanceof Error ? err.message : "Checkout failed");
      setAcquireBusy(false);
    }
  }

  const searching = Boolean(query.trim()) || (category !== "all" && category !== "");

  return (
    <div className="space-y-8" data-dashboard-home>
      <section
        className="sticky top-0 z-20 border-b border-white/15 bg-black/80 px-4 py-3 backdrop-blur sm:px-5"
        data-dashboard-play
        data-dashboard-play-bar
        data-dashboard-home-search
      >
        <form
          className="flex flex-col gap-3"
          onSubmit={(event) => {
            event.preventDefault();
            void startPlay();
          }}
        >
          <div className="min-w-0">
            <p className="mb-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
              Play
            </p>
            <h2 className="text-base font-medium tracking-[-0.3px] text-white sm:text-lg">
              Quick Work Session
            </h2>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">Search maps or start a session</span>
              <input
                data-dashboard-play-prompt
                data-dashboard-home-search-input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search maps or type a topic to start"
                className="w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/80 focus:outline-none"
              />
            </label>
            <label className="block sm:w-52">
              <span className="sr-only">Category</span>
              <select
                value={category}
                onChange={(event) => setCategory(event.target.value)}
                className="w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white focus:border-white/80 focus:outline-none"
              >
                <option value="all">All categories</option>
                {categories.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2" data-dashboard-play-kinds>
            {playKinds.map((item) => {
              const active = kind === item;
              return (
                <button
                  key={item}
                  type="button"
                  data-dashboard-play-kind={item}
                  data-dashboard-play-kind-active={active ? "true" : "false"}
                  onClick={() => setKind(item)}
                  className={`rounded-none border px-3 py-1.5 text-xs font-medium transition ${
                    active
                      ? "border-white/80 bg-white text-black"
                      : "border-white/40 text-white hover:border-white/80"
                  }`}
                >
                  {dashboardPlayKindLabel(item)}
                </button>
              );
            })}
            <button
              type="submit"
              data-dashboard-play-start
              disabled={!canStart || Boolean(busy)}
              className="inline-flex h-10 min-w-[140px] items-center justify-center rounded-none bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
            >
              {busy === "start" ? "Starting…" : `Start ${dashboardPlayKindLabel(kind)}`}
            </button>
            <button
              type="button"
              data-dashboard-play-curious
              disabled={!weeklySessionsAllowed || Boolean(busy)}
              onClick={() => void startCurious()}
              className="inline-flex h-10 items-center justify-center rounded-none border border-white/40 px-4 text-sm font-medium text-white transition hover:border-white/80 disabled:opacity-40"
            >
              {busy === "curious" ? "Finding a topic…" : "I'm feeling Curious"}
            </button>
          </div>
        </form>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        {!hasPaidAccess ? (
          <p className="mt-2 text-xs text-neutral-500" data-dashboard-free-quota>
            {weeklySessionsAllowed
              ? `${weeklySessionsUsed} of ${weeklySessionsLimit ?? 3} free sessions used this week.${
                  weeklySessionsResetAt
                    ? ` Resets ${formatFreeWeekReset(weeklySessionsResetAt)} (UTC).`
                    : ""
                }`
              : freeWeeklySessionLimitMessage(weeklySessionsResetAt || new Date())}
          </p>
        ) : null}
      </section>

      {catalogLoading ? (
        <p className="px-1 text-sm text-neutral-500">Loading maps…</p>
      ) : filtered.length === 0 ? (
        <p className="px-1 text-sm text-neutral-500">
          {searching ? "No maps match that search." : "No public maps yet."}
        </p>
      ) : (
        <>
          {parts.hero.length > 0 ? (
            <section data-dashboard-home-hero className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                Featured
              </p>
              {hero ? (
                <button
                  type="button"
                  onClick={() => void openDetail(hero)}
                  className="group relative block min-h-[22rem] w-full overflow-hidden rounded-none border border-white/25 text-left sm:min-h-[28rem] lg:min-h-[32rem]"
                >
                  <WorkspaceCardHero
                    workspaceId={hero.id}
                    coverImageUrl={hero.coverImageUrl}
                    imagePool={coverImagePool}
                    fallback="aesthetic"
                    heightClassName="absolute inset-0 h-full min-h-[22rem] sm:min-h-[28rem] lg:min-h-[32rem]"
                  />
                  <div className="relative flex h-full min-h-[22rem] flex-col justify-end p-6 sm:min-h-[28rem] sm:p-10 lg:min-h-[32rem]">
                    <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-300">
                      {hero.category}
                      {hero.isAycl && hero.priceLabel ? ` · ${hero.priceLabel}` : ""}
                    </p>
                    <h3 className="mt-2 max-w-3xl text-4xl font-medium tracking-[-1.4px] text-white sm:text-5xl lg:text-6xl">
                      {hero.title}
                    </h3>
                    {heroSummary ? (
                      <p
                        className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-100 line-clamp-5 sm:text-base"
                        data-dashboard-map-hero-summary
                      >
                        {heroSummary}
                      </p>
                    ) : null}
                  </div>
                </button>
              ) : null}
              {parts.hero.length > 1 ? (
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex((index) =>
                        (index - 1 + parts.hero.length) % parts.hero.length,
                      )
                    }
                    className="rounded-none border border-white/40 px-3 py-1.5 text-xs text-white hover:border-white/80"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHeroIndex((index) => (index + 1) % parts.hero.length)
                    }
                    className="rounded-none border border-white/40 px-3 py-1.5 text-xs text-white hover:border-white/80"
                  >
                    Next
                  </button>
                  <p className="font-mono text-[10px] text-neutral-500">
                    {heroIndex + 1} / {parts.hero.length}
                  </p>
                </div>
              ) : null}
            </section>
          ) : null}

          {parts.secondary.length > 0 ? (
            <section data-dashboard-home-secondary className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                More maps
              </p>
              <div className="flex gap-3 overflow-x-auto pb-2">
                {parts.secondary.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    imagePool={coverImagePool}
                    onOpen={() => void openDetail(item)}
                    className="w-[18rem] shrink-0 sm:w-[20rem]"
                  />
                ))}
              </div>
            </section>
          ) : null}

          {parts.grid.length > 0 ? (
            <section data-dashboard-home-maps-grid className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                Maps
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {parts.grid.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    imagePool={coverImagePool}
                    onOpen={() => void openDetail(item)}
                  />
                ))}
              </div>
            </section>
          ) : null}

          {parts.ayclPaid.length > 0 ? (
            <section data-dashboard-home-aycl className="space-y-3">
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                All You Can Learn
              </p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {parts.ayclPaid.map((item) => (
                  <CatalogCard
                    key={item.id}
                    item={item}
                    imagePool={coverImagePool}
                    onOpen={() => void openDetail(item)}
                  />
                ))}
              </div>
            </section>
          ) : (
            <section data-dashboard-home-aycl className="hidden" aria-hidden />
          )}
        </>
      )}

      {emptyWorkspaces && hasPaidAccess ? (
        <section
          data-dashboard-empty-workspaces
          className="console-copy px-6 py-8 sm:px-8"
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {t("dashboard.emptyWorkspacesKicker")}
          </p>
          <h3 className="mt-2 text-xl font-medium tracking-[-0.6px] text-white">
            {t("dashboard.emptyWorkspacesTitle")}
          </h3>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">{t("dashboard.emptyWorkspacesBody")}</p>
          <Link
            href="/workspace/new"
            data-dashboard-empty-create
            className="mt-5 inline-flex h-10 items-center justify-center rounded-none border border-white/40 px-5 text-sm text-white transition hover:border-white/80"
          >
            {t("dashboard.emptyWorkspacesCta")}
          </Link>
        </section>
      ) : null}

      {detail ? (
        <div
          className="fixed inset-0 z-40 flex items-start justify-center overflow-y-auto bg-black/80 p-4 sm:p-8"
          data-dashboard-map-detail
          role="dialog"
          aria-modal="true"
        >
          <div className="console-copy relative w-full max-w-5xl space-y-6 p-5 sm:p-8">
            <button
              type="button"
              onClick={() => setDetail(null)}
              className="absolute right-4 top-4 text-xs text-neutral-400 hover:text-white"
            >
              Close
            </button>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
                {detail.map.category}
                {detail.map.isAycl ? " · All You Can Learn" : ""}
              </p>
              <h3 className="mt-2 text-3xl font-medium tracking-[-1px] text-white">
                {detail.map.title}
              </h3>
              {detail.map.summary ? (
                <p className="mt-3 max-w-2xl text-sm leading-relaxed text-neutral-300">
                  {detail.map.summary}
                </p>
              ) : null}
            </div>
            {detailError ? <p className="text-sm text-red-300">{detailError}</p> : null}
            {detailBusy ? (
              <p className="text-sm text-neutral-500">Loading preview…</p>
            ) : null}
            {detail.landing ? (
              <div
                className="console-copy relative h-[min(28rem,55vh)] overflow-hidden"
                data-dashboard-map-preview
              >
                {detail.landing.map.nodes.length === 0 ? (
                  <div className="flex h-full items-center justify-center text-sm text-neutral-500">
                    Map preview will appear when chapters are published.
                  </div>
                ) : (
                  <BlockSkillGrid
                    nodes={detail.landing.map.nodes as SkillGridNode[]}
                    selectedNodeId={null}
                    onSelectNode={() => {}}
                    canEdit={false}
                    viewOnly
                    learnerMode
                    workspaceId={detail.landing.workspaceId}
                    showProgress={false}
                    onAddBlock={async () => {}}
                    labels={{
                      emptyCell: "",
                      addTitle: "",
                      addPlaceholder: "",
                      addSubmit: "",
                      addCancel: "",
                      suggestTopics: "",
                      suggesting: "",
                      suggestError: "",
                      recenter: "Recenter",
                      zoomIn: "Zoom in",
                      zoomOut: "Zoom out",
                    }}
                  />
                )}
              </div>
            ) : null}
            <div className="flex flex-wrap gap-3">
              {detail.map.isAycl ? (
                <button
                  type="button"
                  data-dashboard-map-buy
                  data-dashboard-add-to-my-maps
                  disabled={acquireBusy || tryBusy}
                  onClick={() => void buyMap(detail.map)}
                  className="inline-flex h-11 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
                >
                  {acquireBusy
                    ? "Redirecting…"
                    : `Buy${detail.map.priceLabel ? ` · ${detail.map.priceLabel}` : ""}`}
                </button>
              ) : (
                <>
                  <button
                    type="button"
                    data-dashboard-add-to-my-maps
                    disabled={acquireBusy || tryBusy}
                    onClick={() => void addToMyMaps(detail.map)}
                    className="inline-flex h-11 items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black hover:bg-neutral-200 disabled:opacity-40"
                  >
                    {acquireBusy ? "Adding…" : "Add to my Maps"}
                  </button>
                  <button
                    type="button"
                    data-dashboard-map-buy
                    className="hidden"
                    aria-hidden
                    tabIndex={-1}
                  />
                </>
              )}
              <button
                type="button"
                data-dashboard-map-try-now
                disabled={
                  acquireBusy ||
                  tryBusy ||
                  detailBusy ||
                  !detail.landing ||
                  detail.landing.map.nodes.length === 0
                }
                onClick={() => void tryNow(detail.map)}
                className="inline-flex h-11 items-center justify-center rounded-none border border-white/40 px-6 text-sm font-medium text-white transition hover:border-white/80 disabled:opacity-40"
              >
                {tryBusy ? "Starting…" : "Try Now"}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <>
          <div data-dashboard-map-detail className="hidden" aria-hidden />
          <button type="button" data-dashboard-add-to-my-maps className="hidden" aria-hidden />
          <button type="button" data-dashboard-map-buy className="hidden" aria-hidden />
          <button type="button" data-dashboard-map-try-now className="hidden" aria-hidden />
        </>
      )}
    </div>
  );
}

function CatalogCard({
  item,
  onOpen,
  imagePool = null,
  className = "",
}: {
  item: PublicMapCatalogItem;
  onOpen: () => void;
  imagePool?: readonly string[] | null;
  className?: string;
}) {
  const summary = truncatePublicMapSummary(item.summary);
  return (
    <button
      type="button"
      onClick={onOpen}
      className={`group relative min-h-[16rem] overflow-hidden rounded-none border border-white/20 text-left transition hover:border-white/60 ${className}`}
    >
      <WorkspaceCardHero
        workspaceId={item.id}
        coverImageUrl={item.coverImageUrl}
        imagePool={imagePool}
        fallback="aesthetic"
        heightClassName="absolute inset-0 h-full min-h-[16rem]"
      />
      <div className="relative flex min-h-[16rem] flex-col justify-end p-3 sm:p-4">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300">
          {item.category}
          {item.isAycl && item.priceLabel ? ` · ${item.priceLabel}` : ""}
        </p>
        <p className="mt-1 text-sm font-medium text-white">{item.title}</p>
        {summary ? (
          <p className="mt-1 line-clamp-3 text-xs leading-relaxed text-neutral-200" data-dashboard-map-card-summary>
            {summary}
          </p>
        ) : null}
      </div>
    </button>
  );
}
