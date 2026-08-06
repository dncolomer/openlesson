"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BlockSkillGrid } from "@/components/BlockSkillGrid";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  ayclLandingCheckoutBody,
  type AyclLandingSummary,
} from "@/lib/aycl-landing";
import {
  AYCL_TOKEN_STORAGE_KEY,
  ayclLifetimeSystemUpdatesClaim,
  ayclLifetimeSystemUpdatesFootnote,
  ayclLifetimeSystemUpdatesHeroLine,
  type AyclAccessTier,
} from "@/lib/aycl-shared";
import type { SkillGridNode } from "@/lib/block-skill-grid";

type ExploreSamples = {
  questions: string[];
  exercises: string[];
  source?: string;
};

export function AyclLandingClient({
  landing,
}: {
  landing: AyclLandingSummary;
}) {
  const [checkoutKey, setCheckoutKey] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [samples, setSamples] = useState<ExploreSamples | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setSamplesLoading(true);
    fetch(`/api/aycl/workspaces/${encodeURIComponent(landing.workspaceId)}/explore-samples`)
      .then((res) => res.json())
      .then((data) => {
        if (cancelled) return;
        if (data?.questions && data?.exercises) {
          setSamples({
            questions: data.questions,
            exercises: data.exercises,
            source: data.source,
          });
        }
      })
      .catch(() => {
        if (!cancelled) setSamples(null);
      })
      .finally(() => {
        if (!cancelled) setSamplesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [landing.workspaceId]);

  const startCheckout = useCallback(
    async (tier: AyclAccessTier) => {
      const key = `${landing.workspaceId}:${tier}`;
      setCheckoutKey(key);
      setError("");
      try {
        const res = await fetch("/api/stripe/create-checkout", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(
            ayclLandingCheckoutBody(landing.workspaceId, tier),
          ),
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
    },
    [landing.workspaceId],
  );

  const nodes = landing.map.nodes as SkillGridNode[];
  const learnerBusy = checkoutKey === `${landing.workspaceId}:learner`;
  const fullBusy = checkoutKey === `${landing.workspaceId}:full`;
  const anyBusy = learnerBusy || fullBusy;

  return (
    <div className="space-y-10" data-aycl-landing>
      {/* Summary + CTA */}
      <section className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]" data-aycl-landing-summary>
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            All-You-Can-Learn · Lifetime access
            {landing.category ? ` · ${landing.category}` : ""}
          </p>
          <h1 className="text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            {landing.title}
          </h1>
          {landing.rootTopic ? (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[1.5px] text-zinc-600">
              {landing.rootTopic}
            </p>
          ) : null}
          {(landing.authorName || landing.authorAvatarUrl) && (
            <div
              className="mt-4 flex items-center gap-3"
              data-aycl-landing-author
            >
              {landing.authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={landing.authorAvatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border border-zinc-700 object-cover"
                  data-aycl-landing-author-avatar
                />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-400"
                  aria-hidden
                >
                  {(landing.authorName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[1.2px] text-zinc-600">
                  Author
                </p>
                <p
                  className="text-sm text-zinc-200"
                  data-aycl-landing-author-name
                >
                  {landing.authorName || "Instructor"}
                </p>
              </div>
            </div>
          )}
          {landing.category ? (
            <span
              className="mt-3 inline-flex rounded-full border border-cyan-500/30 bg-cyan-500/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] text-cyan-200/90"
              data-aycl-landing-category
            >
              {landing.category}
            </span>
          ) : null}
          <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300">
            {landing.summary}
          </p>
          <p
            className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-300"
            data-aycl-lifetime-updates
          >
            {ayclLifetimeSystemUpdatesHeroLine()}
          </p>
          <p
            className="mt-2 max-w-2xl text-xs leading-relaxed text-zinc-500"
            data-aycl-lifetime-updates-claim
          >
            {ayclLifetimeSystemUpdatesClaim()}
          </p>
          {landing.workspaceGoal ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-400">Goal · </span>
              {landing.workspaceGoal}
            </p>
          ) : null}
          <p className="mt-3 text-xs text-zinc-600">
            {landing.blockCount} map block
            {landing.blockCount === 1 ? "" : "s"} · Private fork after purchase ·
            Lifetime system updates
          </p>
          <p className="mt-6">
            <Link
              href={landing.paths.listingPath}
              className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-white"
            >
              ← Back to All-You-Can-Learn catalog
            </Link>
          </p>
        </div>

        <div
          className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-950/80 p-5 backdrop-blur-sm"
          data-aycl-landing-cta
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            Get this environment
          </p>
          {error ? (
            <p className="text-sm text-red-400" data-aycl-landing-error>
              {error}
            </p>
          ) : null}
          <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-white">
                  {landing.offers.learner.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  {landing.offers.learner.description}
                </p>
              </div>
              <p className="text-lg font-semibold text-white">
                {landing.offers.learner.priceLabel}
              </p>
            </div>
            <button
              type="button"
              data-aycl-checkout-learner
              disabled={anyBusy}
              onClick={() => void startCheckout("learner")}
              className="mt-3 w-full rounded-sm border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-100 transition hover:bg-zinc-800 disabled:opacity-50"
            >
              {learnerBusy ? "Redirecting…" : "Get practice access"}
            </button>
          </div>
          <div className="rounded-lg border border-zinc-700 bg-zinc-900/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm font-medium text-white">
                  {landing.offers.full.label}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  {landing.offers.full.description}
                </p>
              </div>
              <p className="text-lg font-semibold text-white">
                {landing.offers.full.priceLabel}
              </p>
            </div>
            <button
              type="button"
              data-aycl-checkout-full
              disabled={anyBusy}
              onClick={() => void startCheckout("full")}
              className="mt-3 w-full rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
            >
              {fullBusy ? "Redirecting…" : "Get full access"}
            </button>
          </div>
          <p
            className="text-[11px] text-zinc-600"
            data-aycl-lifetime-updates-footnote
          >
            {ayclLifetimeSystemUpdatesFootnote()}
            {" · "}
            Upgrade anytime
          </p>
        </div>
      </section>

      {/* View-only map snapshot */}
      <section data-aycl-landing-map>
        <h2 className="mb-3 text-lg font-medium text-white">Workspace map</h2>
        <p className="mb-4 max-w-2xl text-sm text-zinc-500">
          A view-only snapshot of the learning map. Pan and zoom to look around —
          editing and practice open after you get access.
        </p>
        <div
          className="h-[min(28rem,55vh)] overflow-hidden rounded-xl border border-zinc-800 bg-zinc-950/90"
          data-aycl-map-snapshot
          data-map-view-only="true"
        >
          {nodes.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-zinc-600">
              Map content will appear here when chapters are published.
            </div>
          ) : (
            <BlockSkillGrid
              nodes={nodes}
              selectedNodeId={null}
              onSelectNode={() => {}}
              canEdit={false}
              viewOnly
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
      </section>

      {/* Things you'll Explore and Learn */}
      <section data-aycl-landing-explore-learn>
        <h2 className="mb-2 text-lg font-medium text-white">
          Things you&apos;ll Explore and Learn
        </h2>
        <p className="mb-6 max-w-2xl text-sm text-zinc-500">
          Sample exploratory questions and exercises generated for this
          environment — a taste of the practice you&apos;ll get inside.
        </p>

        {samplesLoading ? (
          <div className="flex justify-center py-10">
            <LoadingStatusMessage message="Generating samples" />
          </div>
        ) : samples ? (
          <div className="grid gap-6 md:grid-cols-2">
            <div data-aycl-landing-questions>
              <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Exploratory questions
              </h3>
              <ul className="space-y-3">
                {samples.questions.map((q, i) => (
                  <li
                    key={`q-${i}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm leading-relaxed text-zinc-300"
                    data-aycl-landing-question
                  >
                    {q}
                  </li>
                ))}
              </ul>
            </div>
            <div data-aycl-landing-exercises>
              <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                Example exercises
              </h3>
              <ul className="space-y-3">
                {samples.exercises.map((ex, i) => (
                  <li
                    key={`ex-${i}`}
                    className="rounded-lg border border-zinc-800 bg-zinc-950/70 px-4 py-3 text-sm leading-relaxed text-zinc-300"
                    data-aycl-landing-exercise
                  >
                    {ex}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-zinc-600">
            Samples could not be loaded. Open the catalog to purchase and explore
            inside the workspace.
          </p>
        )}
      </section>
    </div>
  );
}
