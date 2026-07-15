"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { WorkspaceCardHero } from "@/components/WorkspaceCardHero";
import { aestheticImageForId } from "@/lib/aesthetics";
import { AYCL_PRICE_LABEL, AYCL_TOKEN_STORAGE_KEY } from "@/lib/aycl-shared";

const BACKGROUND_IMAGE = aestheticImageForId("all-you-can-learn", [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/galactic-stoneworks/HHjOxLWXMAEFcn0.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
]);

interface CatalogWorkspace {
  id: string;
  title: string;
  description?: string | null;
  cover_image_url?: string | null;
  priceLabel: string;
}

export default function AllYouCanLearnPage() {
  const [workspaces, setWorkspaces] = useState<CatalogWorkspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [checkoutWorkspaceId, setCheckoutWorkspaceId] = useState<string | null>(null);
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

  const startCheckout = async (workspaceId: string) => {
    setCheckoutWorkspaceId(workspaceId);
    setError("");
    try {
      const res = await fetch("/api/stripe/create-checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          priceType: "all_you_can_learn",
          workspaceId,
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
      setCheckoutWorkspaceId(null);
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

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 text-center">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            Recreational learning · Lifetime access
          </p>
          <h1 className="text-3xl font-medium tracking-[-1.6px] text-white sm:text-5xl">
            All-You-Can-Learn
          </h1>
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
        </header>

        {error ? (
          <p className="mb-6 text-center text-sm text-red-400">{error}</p>
        ) : null}

        <div className="mb-5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            Curated learning environments
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-white/20 border-t-white" />
          </div>
        ) : workspaces.length === 0 ? (
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 px-6 py-12 text-center backdrop-blur-sm">
            <p className="text-zinc-400">No learning environments are available yet.</p>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2">
            {workspaces.map((workspace) => (
              <article
                key={workspace.id}
                className="group overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm transition hover:border-zinc-600"
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
                    <h2 className="text-xl font-medium leading-tight text-white">{workspace.title}</h2>
                    {workspace.description ? (
                      <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                        {workspace.description}
                      </p>
                    ) : null}
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xl font-semibold text-white">{workspace.priceLabel}</p>
                      <p className="text-xs text-zinc-500">One-time · Fork yours for life</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => startCheckout(workspace.id)}
                      disabled={checkoutWorkspaceId === workspace.id}
                      className="rounded-sm bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
                    >
                      {checkoutWorkspaceId === workspace.id ? "Redirecting…" : "Get access"}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        <p className="mt-10 text-center text-xs text-zinc-600">
          Already purchased?{" "}
          <Link href="/learn" className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white">
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

export { AYCL_PRICE_LABEL, AYCL_TOKEN_STORAGE_KEY };