"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { aestheticImageForId } from "@/lib/aesthetics";
import {
  AYCL_FULL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_LABEL,
  AYCL_TOKEN_STORAGE_KEY,
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

type AyclTab = "lifetime" | "hackathons";

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

const HACKATHONS = [
  {
    id: "pc-hackathon",
    title: "Probabilistic Computing Hackathon",
    host: "ETH Zurich",
    date: "June 10, 2026",
    location: "Zurich, Switzerland",
    status: "Past event" as const,
    description:
      "A hands-on day on probabilistic and thermodynamic computing — Energy-Based Models, THRML, lectures, team builds, and demos. Winners and lifetime packages coming soon.",
    href: "/hackathons/probabilistic-computing",
    image:
      "https://cdn.sanity.io/images/otrk6k1t/production/7ef4d9c0fcf06719cb7ddd7ebdb20b02a2355793-1736x1284.webp?auto=format&fit=max&q=75&w=868",
  },
] as const;

const TABS: { id: AyclTab; label: string }[] = [
  { id: "lifetime", label: "Lifetime access" },
  { id: "hackathons", label: "Hackathons" },
];

const VALID_TABS = new Set<AyclTab>(["lifetime", "hackathons"]);

function parseTab(value: string | null): AyclTab {
  if (value && VALID_TABS.has(value as AyclTab)) {
    return value as AyclTab;
  }
  return "lifetime";
}

export default function AllYouCanLearnPage() {
  return (
    <Suspense
      fallback={
        <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0a0a0a] text-zinc-200">
          <LoadingStatusMessage message="Loading" />
        </main>
      }
    >
      <AllYouCanLearnContent />
    </Suspense>
  );
}

function AllYouCanLearnContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [activeTab, setActiveTab] = useState<AyclTab>(() => parseTab(searchParams.get("tab")));
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    setActiveTab(parseTab(searchParams.get("tab")));
  }, [searchParams]);

  useEffect(() => {
    fetch("/api/aycl/workspaces")
      .then((res) => res.json())
      .then((data) => {
        setWorkspaces(data.workspaces || []);
      })
      .catch(() => setError("Failed to load workspaces"))
      .finally(() => setLoading(false));
  }, []);

  const setAyclTab = (tab: AyclTab) => {
    setActiveTab(tab);
    router.replace(`/all-you-can-learn?tab=${tab}`, { scroll: false });
  };

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

      {/* Tab switcher — dashboard-style underline bar */}
      <div className="relative z-10 border-b border-neutral-800/60">
        <div className="mx-auto flex max-w-5xl items-center justify-center px-4 sm:px-6">
          <div className="flex gap-1 overflow-x-auto" role="tablist" aria-label="All-You-Can-Learn sections">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={activeTab === tab.id}
                onClick={() => setAyclTab(tab.id)}
                className={`relative whitespace-nowrap px-4 py-3 text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? "text-white"
                    : "text-neutral-500 hover:text-neutral-300"
                }`}
              >
                {tab.label}
                {activeTab === tab.id ? (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-white" />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-8 text-center">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            Recreational learning · Events
          </p>
          <h1 className="text-3xl font-medium tracking-[-1.6px] text-white sm:text-5xl">
            All-You-Can-Learn
          </h1>
          {activeTab === "lifetime" ? (
            <>
              <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
                For people who binge-learn for the sake of learning — not a credential, a cohort, or a
                deadline. Pick a topic, dive deep on a Saturday, wander back months later, and follow
                curiosity wherever it pulls you.
              </p>
              <p className="mx-auto mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500 sm:text-base">
                Each package below is an editorially curated, dynamic learning environment: a living
                workspace with chapters, practice, and depth already wired in. Pay once, fork it to
                your private copy, and make it yours for life — your link, your pace, your rabbit holes.
              </p>
            </>
          ) : (
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
              In-person and online events where curious people learn frontier knowledge by doing — lectures,
              mentors, teams, and demos on ideas that are still taking shape across science, culture, and
              practice.
            </p>
          )}
        </header>

        {error ? (
          <p className="mb-6 text-center text-sm text-red-400">{error}</p>
        ) : null}

        {activeTab === "lifetime" ? (
          <LifetimeAccessTab
            workspaces={workspaces}
            loading={loading}
            checkoutKey={checkoutKey}
            onCheckout={startCheckout}
          />
        ) : (
          <HackathonsTab />
        )}
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}

function LifetimeAccessTab({
  workspaces,
  loading,
  checkoutKey,
  onCheckout,
}: {
  workspaces: CatalogWorkspace[];
  loading: boolean;
  checkoutKey: string | null;
  onCheckout: (workspaceId: string, tier: AyclAccessTier) => void;
}) {
  return (
    <>
      <div className="mb-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
          Curated learning environments
        </p>
        <p className="mx-auto mt-2 max-w-xl text-xs leading-relaxed text-zinc-500">
          Choose practice-only access (fixed private copy) or full access with
          creation tools so you can grow the map. You can upgrade later on the
          same access link.
        </p>
      </div>

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
              priceLabel:
                workspace.priceLabel || AYCL_FULL_PRICE_LABEL,
            };
            const learnerBusy = checkoutKey === `${workspace.id}:learner`;
            const fullBusy = checkoutKey === `${workspace.id}:full`;
            const anyBusy = learnerBusy || fullBusy;
            return (
              <article
                key={workspace.id}
                className="group overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm transition hover:border-zinc-600"
                data-aycl-catalog-card
              >
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
                <div className="space-y-4 p-5">
                  <div>
                    <h2 className="text-xl font-medium leading-tight text-white">
                      {workspace.title}
                    </h2>
                    {workspace.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        {workspace.description}
                      </p>
                    ) : null}
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
                        onClick={() => onCheckout(workspace.id, "learner")}
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
                        onClick={() => onCheckout(workspace.id, "full")}
                        disabled={anyBusy}
                        className="mt-3 w-full rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                      >
                        {fullBusy ? "Redirecting…" : "Get full access"}
                      </button>
                    </div>
                  </div>

                  <p className="text-[11px] text-zinc-600">
                    One-time · Private fork · Upgrade anytime from practice
                  </p>
                </div>
              </article>
            );
          })}
        </div>
      )}

      <p className="mt-10 text-center text-xs text-zinc-600">
        Already purchased?{" "}
        <Link href="/learn" className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white">
          Open your lifetime access link
        </Link>{" "}
        to return to your workspace.
      </p>
    </>
  );
}

function HackathonsTab() {
  return (
    <>
      <div className="mb-5 text-center">
        <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
          Past & upcoming events
        </p>
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        {HACKATHONS.map((hackathon) => (
          <Link
            key={hackathon.id}
            href={hackathon.href}
            className="group overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm transition hover:border-zinc-600"
          >
            <div
              className="relative h-44 bg-cover bg-center sm:h-48"
              style={{ backgroundImage: `url(${hackathon.image})` }}
            >
              <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
              <span className="absolute left-4 top-4 border border-zinc-600/80 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-300 backdrop-blur-sm">
                {hackathon.status}
              </span>
            </div>
            <div className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-2">
                <span className="border border-cyan-500/30 bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-cyan-200/90">
                  Hackathon
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                  {hackathon.host}
                </span>
              </div>
              <div>
                <h2 className="text-xl font-medium leading-tight text-white group-hover:text-zinc-100">
                  {hackathon.title}
                </h2>
                <p className="mt-2 text-sm leading-relaxed text-zinc-500">{hackathon.description}</p>
              </div>
              <div className="flex items-end justify-between gap-3">
                <div className="space-y-1 text-xs text-zinc-500">
                  <p>{hackathon.date}</p>
                  <p>{hackathon.location}</p>
                </div>
                <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                  View event
                  <ArrowRight size={14} className="transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>

      <p className="mt-10 text-center text-xs text-zinc-600">
        Hosting a hackathon with Uncertain Systems?{" "}
        <a
          href="mailto:uncertainsystems@gmail.com"
          className="inline-flex items-center gap-1 text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white"
        >
          Get in touch
          <ArrowRight size={12} />
        </a>
      </p>
    </>
  );
}

export { AYCL_FULL_PRICE_LABEL as AYCL_PRICE_LABEL, AYCL_TOKEN_STORAGE_KEY };
