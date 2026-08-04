"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { aestheticImageForId } from "@/lib/aesthetics";
import { ayclLandingPath } from "@/lib/aycl-landing";
import {
  AYCL_FULL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_LABEL,
  AYCL_TOKEN_STORAGE_KEY,
  ayclCatalogKeyPoints,
  ayclLifetimeSystemUpdatesFootnote,
  ayclOfferDescription,
  ayclOfferLabel,
  type AyclAccessTier,
} from "@/lib/aycl-shared";

const BACKGROUND_IMAGE = aestheticImageForId("all-you-can-learn", [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
]);

interface CatalogOffer {
  tier: AyclAccessTier;
  label: string;
  description: string;
  priceLabel: string;
}

interface CatalogWorkspace {
  id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  /** @deprecated prefer offers.full.priceLabel */
  priceLabel: string;
  offers?: {
    learner: CatalogOffer;
    full: CatalogOffer;
  };
}

export default function AllYouCanLearnPage() {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/aycl/workspaces")
      .then((res) => res.json())
      .then((data) => {
        setWorkspaces(data.workspaces || []);
      })
      .catch(() => setError("Failed to load workspaces"))
      .finally(() => setLoading(false));
  }, []);

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

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-6 sm:px-6 sm:py-8">
        <header
          className="relative mb-6 overflow-hidden rounded-2xl border border-zinc-700/60 bg-zinc-950/70 shadow-[0_20px_50px_rgba(0,0,0,0.45)] backdrop-blur-md"
          data-aycl-catalog-hero
        >
          {/* Soft ambient accents */}
          <div
            className="pointer-events-none absolute -left-16 -top-20 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute -bottom-16 -right-10 h-44 w-44 rounded-full bg-amber-400/10 blur-3xl"
            aria-hidden
          />
          <div
            className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/25 to-transparent"
            aria-hidden
          />

          <div className="relative px-5 py-7 text-center sm:px-8 sm:py-8">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full border border-zinc-700/80 bg-black/40 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-400">
              <span
                className="h-1.5 w-1.5 rounded-full bg-amber-300/90 shadow-[0_0_8px_rgba(252,211,77,0.7)]"
                aria-hidden
              />
              Recreational learning · Lifetime access
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
                    className="group flex gap-3 rounded-xl border border-zinc-700/70 bg-gradient-to-br from-zinc-900/90 to-zinc-950/90 px-3.5 py-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] transition hover:border-zinc-500/80 hover:from-zinc-900 hover:to-zinc-950"
                    data-aycl-catalog-key-point
                    data-aycl-catalog-key-point-index={index}
                  >
                    <span
                      className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/[0.06] text-[11px] font-semibold text-zinc-200"
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
                  href="/hackathons"
                  className="text-zinc-300 underline decoration-zinc-600 underline-offset-2 transition hover:text-white"
                  data-aycl-hackathons-link
                >
                  Hackathons
                </Link>
              </p>
            </div>
          </div>
        </header>

        {error ? (
          <p className="mb-4 text-center text-sm text-red-400">{error}</p>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-16">
            <LoadingStatusMessage message="Loading" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center backdrop-blur-sm">
            <p className="text-zinc-400">No learning environments are available yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {workspaces.map((workspace) => {
              const learnerOffer = workspace.offers?.learner ?? {
                tier: "learner" as const,
                label: ayclOfferLabel("learner"),
                description: ayclOfferDescription("learner"),
                priceLabel: AYCL_LEARNER_PRICE_LABEL,
              };
              const fullOffer = workspace.offers?.full ?? {
                tier: "full" as const,
                label: ayclOfferLabel("full"),
                description: ayclOfferDescription("full"),
                priceLabel: workspace.priceLabel || AYCL_FULL_PRICE_LABEL,
              };
              const learnerBusy = checkoutKey === `${workspace.id}:learner`;
              const fullBusy = checkoutKey === `${workspace.id}:full`;
              const anyBusy = learnerBusy || fullBusy;
              const landingHref = ayclLandingPath(workspace.id);
              return (
                <article
                  key={workspace.id}
                  className="group overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm transition hover:border-zinc-600"
                  data-aycl-catalog-card
                >
                  <Link href={landingHref} data-aycl-catalog-landing-link>
                    <WorkspaceCardHero
                      workspaceId={workspace.id}
                      coverImageUrl={workspace.cover_image_url}
                      fallback="aesthetic"
                      heightClassName="h-44 sm:h-48"
                      badges={
                        <span className="border border-amber-500/30 bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-amber-200/90 backdrop-blur-sm">
                          Lifetime access
                        </span>
                      }
                    />
                  </Link>
                  <div className="space-y-4 p-5">
                    <div>
                      <h2 className="text-xl font-medium leading-tight text-white">
                        <Link
                          href={landingHref}
                          className="hover:underline"
                          data-aycl-catalog-title-link
                        >
                          {workspace.title}
                        </Link>
                      </h2>
                      {workspace.description ? (
                        <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                          {workspace.description}
                        </p>
                      ) : null}
                      <Link
                        href={landingHref}
                        className="mt-2 inline-block text-xs font-medium text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white"
                      >
                        Preview map & samples →
                      </Link>
                    </div>

                    <div className="grid gap-3" data-aycl-dual-offers>
                      <div
                        className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3"
                        data-aycl-offer="learner"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">
                              {learnerOffer.label}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                              {learnerOffer.description}
                            </p>
                          </div>
                          <p className="shrink-0 text-lg font-semibold text-white">
                            {learnerOffer.priceLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          data-aycl-checkout-learner
                          onClick={() => startCheckout(workspace.id, "learner")}
                          disabled={anyBusy}
                          className="mt-3 w-full rounded-sm border border-zinc-600 bg-transparent px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
                        >
                          {learnerBusy ? "Redirecting…" : "Get practice access"}
                        </button>
                      </div>

                      <div
                        className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3"
                        data-aycl-offer="full"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-white">
                              {fullOffer.label}
                            </p>
                            <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                              {fullOffer.description}
                            </p>
                          </div>
                          <p className="shrink-0 text-lg font-semibold text-white">
                            {fullOffer.priceLabel}
                          </p>
                        </div>
                        <button
                          type="button"
                          data-aycl-checkout-full
                          onClick={() => startCheckout(workspace.id, "full")}
                          disabled={anyBusy}
                          className="mt-3 w-full rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                        >
                          {fullBusy ? "Redirecting…" : "Get full access"}
                        </button>
                      </div>
                    </div>

                    <p
                      className="text-[11px] text-zinc-600"
                      data-aycl-lifetime-updates-footnote
                    >
                      {ayclLifetimeSystemUpdatesFootnote()}
                      {" · "}
                      Upgrade anytime from practice
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-zinc-600">
          Already purchased?{" "}
          <Link
            href="/learn"
            className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white"
          >
            Open your lifetime access link
          </Link>{" "}
          to return to your workspace.
        </p>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
