"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { aestheticImageForId } from "@/lib/aesthetics";
import { ayclLandingPath } from "@/lib/aycl-landing";
import {
  AYCL_TOKEN_STORAGE_KEY,
  ayclBuildTooltip,
  ayclCatalogKeyPoints,
  ayclLifetimeSystemUpdatesFootnote,
  ayclOfferCheckoutCta,
  ayclOfferLabel,
  ayclOfferTooltip,
  ayclPlayTooltip,
  type AyclAccessTier,
} from "@/lib/aycl-shared";
import {
  collectAyclCatalogCategories,
  filterAyclCatalogCards,
  type AyclCatalogCardDto,
} from "@/lib/aycl-marketplace";

const BACKGROUND_IMAGE = aestheticImageForId("all-you-can-learn", [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
]);

export default function AllYouCanLearnPage() {
  const [workspaces, setWorkspaces] = useState<AyclCatalogCardDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    fetch("/api/aycl/workspaces")
      .then((res) => res.json())
      .then((data) => {
        setWorkspaces(data.workspaces || []);
      })
      .catch(() => setError("Failed to load workspaces"))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(
    () => collectAyclCatalogCategories(workspaces),
    [workspaces],
  );

  const filtered = useMemo(
    () =>
      filterAyclCatalogCards(workspaces, {
        category: categoryFilter,
        query: searchQuery,
      }),
    [workspaces, categoryFilter, searchQuery],
  );

  const startCheckout = async (
    workspaceId: string,
    tier: AyclAccessTier = "full",
  ) => {
    const key = `${workspaceId}:${tier}`;
    setCheckoutKey(key);
    setError("");
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceType: "all_you_can_learn",
          workspaceId,
          ayclAccessTier: tier,
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Checkout failed");
      }
      if (data.ayclAccessToken) {
        sessionStorage.setItem(AYCL_TOKEN_STORAGE_KEY, data.ayclAccessToken);
      }
      window.location.href = data.url;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Checkout failed");
      setCheckoutKey(null);
    }
  };

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />
      <div className="fixed inset-0 z-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:72px_72px] opacity-40" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
        <header
          className="relative mb-6 overflow-hidden rounded-none border border-zinc-700/60 bg-zinc-950/70 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
          data-aycl-catalog-hero
        >
          <div
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-neutral-800/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-neutral-800/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            aria-hidden
          />

          <div className="relative px-5 py-7 text-center sm:px-8 sm:py-8">
            <p className="mb-3 inline-flex items-center gap-2 rounded-none border border-zinc-700/80 bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-400">
              <span
                className="h-1.5 w-1.5 rounded-full bg-neutral-900/90 shadow-[0_0_8px_rgba(252,211,77,0.7)]"
                aria-hidden
              />
              Marketplace · Recreational learning · Lifetime access
            </p>
            <h1 className="bg-gradient-to-b from-white via-white to-zinc-400 bg-clip-text text-3xl font-medium tracking-[-1.6px] text-transparent sm:text-5xl">
              All-You-Can-Learn
            </h1>

            <div
              className="mx-auto mt-6 max-w-2xl"
              data-aycl-catalog-key-points
            >
              <div className="grid gap-2.5 sm:grid-cols-2">
                {ayclCatalogKeyPoints().map((point, index) => (
                  <div
                    key={point}
                    className="group flex gap-3 rounded-none border border-zinc-700/70 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-zinc-500/80 hover:from-zinc-900 hover:to-zinc-950"
                    data-aycl-catalog-key-point
                    data-aycl-catalog-key-point-index={index}
                  >
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-none border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-zinc-200"
                      aria-hidden
                    >
                      {index + 1}
                    </span>
                    <span className="text-[13px] leading-snug text-zinc-200 sm:text-sm">
                      {point}
                    </span>
                  </div>
                ))}
              </div>
              <p className="mt-4 text-[11px] text-zinc-500">
                Practice-only or full access · upgrade anytime ·{" "}
                <Link
                  href="/community-events"
                  className="text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-white"
                  data-aycl-hackathons-link
                >
                  Community Events
                </Link>
              </p>
            </div>
          </div>
        </header>

        {/* Marketplace search + category filters */}
        {!loading && workspaces.length > 0 ? (
          <div
            className="mb-6 space-y-3 rounded-none border border-zinc-800/80 bg-zinc-950/60 p-4 backdrop-blur-sm"
            data-aycl-marketplace-filters
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <label className="relative min-w-0 flex-1">
                <span className="sr-only">Search courses</span>
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search title, author, category…"
                  data-aycl-marketplace-search
                  className="w-full rounded-none border border-zinc-700/80 bg-black/40 px-3.5 py-2.5 text-sm text-white placeholder:text-zinc-600 focus:border-zinc-500 focus:outline-none"
                />
              </label>
              <p
                className="shrink-0 font-mono text-[11px] uppercase tracking-[1.5px] text-zinc-500"
                data-aycl-marketplace-result-count
              >
                {filtered.length} of {workspaces.length}
              </p>
            </div>
            <div
              className="flex flex-wrap gap-2"
              data-aycl-marketplace-category-chips
              role="group"
              aria-label="Filter by category"
            >
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                data-aycl-category-chip="all"
                data-aycl-category-chip-active={
                  categoryFilter === "all" ? "true" : "false"
                }
                className={`rounded-none border px-3 py-1 text-xs transition ${
                  categoryFilter === "all"
                    ? "border-neutral-600/40 bg-neutral-800/15 text-neutral-200"
                    : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                }`}
              >
                All
              </button>
              {categories.map((cat) => {
                const active = categoryFilter.toLowerCase() === cat.toLowerCase();
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategoryFilter(cat)}
                    data-aycl-category-chip={cat}
                    data-aycl-category-chip-active={active ? "true" : "false"}
                    className={`rounded-none border px-3 py-1 text-xs transition ${
                      active
                        ? "border-neutral-600/40 bg-neutral-800/15 text-neutral-200"
                        : "border-zinc-700 bg-zinc-900/60 text-zinc-400 hover:border-zinc-500 hover:text-zinc-200"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="mb-4 text-center text-sm text-red-400">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingStatusMessage message="Loading" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-none border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center backdrop-blur-sm">
            <p className="text-zinc-400">No learning environments are available yet.</p>
          </div>
        ) : filtered.length === 0 ? (
          <div
            className="rounded-none border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center backdrop-blur-sm"
            data-aycl-marketplace-empty-filter
          >
            <p className="text-zinc-400">No courses match this filter.</p>
            <button
              type="button"
              onClick={() => {
                setCategoryFilter("all");
                setSearchQuery("");
              }}
              className="mt-3 text-sm text-zinc-300 underline decoration-zinc-600 underline-offset-2 hover:text-white"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <div
            className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3"
            data-aycl-marketplace-grid
          >
            {filtered.map((workspace) => {
              const learnerOffer = workspace.offers.learner;
              const fullOffer = workspace.offers.full;
              const learnerBusy = checkoutKey === `${workspace.id}:learner`;
              const fullBusy = checkoutKey === `${workspace.id}:full`;
              const anyBusy = learnerBusy || fullBusy;
              const landingHref = ayclLandingPath(workspace.id);
              const blurb = workspace.summary || workspace.description;
              return (
                <article
                  key={workspace.id}
                  className="group flex flex-col overflow-hidden rounded-none border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm transition hover:border-zinc-600"
                  data-aycl-catalog-card
                  data-aycl-card-category={workspace.category || ""}
                >
                  <Link href={landingHref} data-aycl-catalog-landing-link>
                    <WorkspaceCardHero
                      workspaceId={workspace.id}
                      coverImageUrl={workspace.cover_image_url}
                      fallback="aesthetic"
                      heightClassName="h-40 sm:h-44"
                      badges={
                        <div className="flex flex-wrap gap-1.5">
                          {workspace.category ? (
                            <span
                              className="border border-neutral-600/30 bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300/90 backdrop-blur-sm"
                              data-aycl-card-category-badge
                            >
                              {workspace.category}
                            </span>
                          ) : null}
                          <span className="border border-neutral-600/30 bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300/90 backdrop-blur-sm">
                            Lifetime
                          </span>
                        </div>
                      }
                    />
                  </Link>
                  <div className="flex flex-1 flex-col space-y-3 p-4">
                    <div className="min-w-0 flex-1">
                      <h2 className="text-lg font-medium leading-tight text-white">
                        <Link
                          href={landingHref}
                          className="hover:underline"
                          data-aycl-catalog-title-link
                        >
                          {workspace.title}
                        </Link>
                      </h2>
                      {blurb ? (
                        <p
                          className="mt-2 line-clamp-3 text-sm leading-relaxed text-zinc-500"
                          data-aycl-card-summary
                        >
                          {blurb}
                        </p>
                      ) : null}

                      {(workspace.authorName || workspace.authorAvatarUrl) && (
                        <div
                          className="mt-3 flex items-center gap-2"
                          data-aycl-card-author
                        >
                          {workspace.authorAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={workspace.authorAvatarUrl}
                              alt=""
                              className="h-7 w-7 rounded-full border border-zinc-700 object-cover"
                              data-aycl-card-author-avatar
                            />
                          ) : (
                            <span
                              className="flex h-7 w-7 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-[10px] font-medium text-zinc-400"
                              aria-hidden
                            >
                              {(workspace.authorName || "?").slice(0, 1).toUpperCase()}
                            </span>
                          )}
                          <span
                            className="truncate text-xs text-zinc-400"
                            data-aycl-card-author-name
                          >
                            {workspace.authorName || "Author"}
                          </span>
                        </div>
                      )}

                      <div
                        className="mt-3 flex flex-wrap items-center gap-2"
                        data-aycl-card-price-chips
                      >
                        <span
                          className="rounded-none border border-zinc-700 bg-zinc-900/80 px-2 py-0.5 text-[11px] text-zinc-300"
                          data-aycl-card-price-learner
                          title={ayclOfferTooltip("learner")}
                          data-aycl-offer-tooltip="learner"
                        >
                          <span title={ayclPlayTooltip()} data-aycl-play-tooltip>
                            {ayclOfferLabel("learner")}
                          </span>{" "}
                          {learnerOffer.priceLabel}
                        </span>
                        <span
                          className="rounded-none border border-zinc-600 bg-zinc-800/80 px-2 py-0.5 text-[11px] font-medium text-white"
                          data-aycl-card-price-full
                          title={ayclOfferTooltip("full")}
                          data-aycl-offer-tooltip="full"
                        >
                          <span title={ayclPlayTooltip()} data-aycl-play-tooltip>
                            Play
                          </span>
                          {" + "}
                          <span title={ayclBuildTooltip()} data-aycl-build-tooltip>
                            Build
                          </span>{" "}
                          {fullOffer.priceLabel}
                        </span>
                      </div>

                      <Link
                        href={landingHref}
                        className="mt-2 inline-block text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white"
                      >
                        Preview map & samples →
                      </Link>
                    </div>

                    <div className="grid gap-2" data-aycl-dual-offers>
                      <button
                        type="button"
                        data-aycl-checkout-learner
                        onClick={() => startCheckout(workspace.id, "learner")}
                        disabled={anyBusy}
                        className="w-full rounded-sm border border-zinc-600 bg-transparent px-3 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
                        title={ayclOfferTooltip("learner")}
                      >
                        {learnerBusy
                          ? "Redirecting…"
                          : `${ayclOfferCheckoutCta("learner")} · ${learnerOffer.priceLabel}`}
                      </button>
                      <button
                        type="button"
                        data-aycl-checkout-full
                        onClick={() => startCheckout(workspace.id, "full")}
                        disabled={anyBusy}
                        className="w-full rounded-sm bg-white px-3 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                        title={ayclOfferTooltip("full")}
                      >
                        {fullBusy
                          ? "Redirecting…"
                          : `${ayclOfferCheckoutCta("full")} · ${fullOffer.priceLabel}`}
                      </button>
                    </div>

                    <p
                      className="text-[10px] leading-relaxed text-zinc-600"
                      data-aycl-lifetime-updates-footnote
                    >
                      {ayclLifetimeSystemUpdatesFootnote()}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-zinc-600">
          Already purchased? Use the lifetime access link from your purchase email
          to return to your workspace.
        </p>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
