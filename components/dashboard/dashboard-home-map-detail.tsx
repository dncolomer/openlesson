"use client";

import { useEffect, useState } from "react";
import { BlockSkillGrid } from "@/components/BlockSkillGrid";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import {
  ayclMapPreviewFullscreenActive,
  toggleAyclMapPreviewFullscreen,
  type AyclLandingSummary,
} from "@/lib/aycl-landing";
import {
  ayclOfferCheckoutCta,
  ayclOfferLabel,
  ayclOfferTooltip,
} from "@/lib/aycl-shared";
import type { PublicMapCatalogItem } from "@/lib/dashboard-home-catalog";
import type { SkillGridNode } from "@/lib/block-skill-grid";
import {
  ADD_TO_MY_MAPS_LABEL,
  REMOVE_FROM_MY_MAPS_LABEL,
} from "@/lib/workspace-play-copy";

export type DashboardHomeMapDetailState = {
  map: PublicMapCatalogItem;
  landing: AyclLandingSummary | null;
};

type ExploreSamples = {
  questions: string[];
  exercises: string[];
};

const MAP_PREVIEW_LABELS = {
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
};

export function DashboardHomeMapDetail({
  detail,
  busy,
  error,
  inMyMaps,
  acquireBusy,
  tryBusy,
  onBack,
  onAdd,
  onRemove,
  onBuy,
  onTry,
}: {
  detail: DashboardHomeMapDetailState;
  busy: boolean;
  error: string;
  inMyMaps: boolean;
  acquireBusy: boolean;
  tryBusy: boolean;
  onBack: () => void;
  onAdd: (item: PublicMapCatalogItem) => void;
  onRemove: (item: PublicMapCatalogItem) => void;
  onBuy: (item: PublicMapCatalogItem) => void;
  onTry: (item: PublicMapCatalogItem) => void;
}) {
  const [mapFullscreen, setMapFullscreen] = useState(false);
  const [samples, setSamples] = useState<ExploreSamples | null>(null);
  const [samplesLoading, setSamplesLoading] = useState(false);
  const mapIsFullscreen = ayclMapPreviewFullscreenActive(mapFullscreen);
  const landing = detail.landing;
  const nodes = (landing?.map.nodes ?? []) as SkillGridNode[];
  const title = landing?.title || detail.map.title;
  const summary = landing?.summary || detail.map.summary;
  const category = landing?.category || detail.map.category;
  const isAycl = detail.map.isAycl;
  const authorName = landing?.authorName;
  const authorAvatarUrl = landing?.authorAvatarUrl;

  useEffect(() => {
    setMapFullscreen(false);
    const root = document.querySelector("[data-dashboard-map-detail]");
    let node: HTMLElement | null = root instanceof HTMLElement ? root : null;
    while (node) {
      const overflowY = window.getComputedStyle(node).overflowY;
      if (overflowY === "auto" || overflowY === "scroll") {
        node.scrollTop = 0;
        break;
      }
      node = node.parentElement;
    }
    window.scrollTo(0, 0);
  }, [detail.map.id]);

  useEffect(() => {
    if (!mapIsFullscreen) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") setMapFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mapIsFullscreen]);

  useEffect(() => {
    if (!isAycl || !landing?.workspaceId) {
      setSamples(null);
      setSamplesLoading(false);
      return;
    }
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
          });
        } else {
          setSamples(null);
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
  }, [isAycl, landing?.workspaceId]);

  const offer = landing?.offers.full;
  const priceLabel = detail.map.priceLabel || offer?.priceLabel || "";
  const actionsBusy = acquireBusy || tryBusy;

  return (
    <div className="space-y-10" data-dashboard-map-detail>
      <button
        type="button"
        data-dashboard-map-back
        onClick={onBack}
        className="text-sm text-zinc-500 underline decoration-zinc-700 underline-offset-2 hover:text-white"
      >
        ← Back to maps
      </button>

      <section
        className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr]"
        data-dashboard-map-detail-summary
      >
        <div>
          <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            {isAycl ? "All-You-Can-Learn" : "Learning Map"}
            {category ? ` · ${category}` : ""}
          </p>
          <h1 className="text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            {title}
          </h1>
          {landing?.rootTopic ? (
            <p className="mt-2 font-mono text-[11px] uppercase tracking-[1.5px] text-zinc-600">
              {landing.rootTopic}
            </p>
          ) : null}
          {authorName || authorAvatarUrl ? (
            <div className="mt-4 flex items-center gap-3" data-dashboard-map-detail-author>
              {authorAvatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={authorAvatarUrl}
                  alt=""
                  className="h-10 w-10 rounded-full border border-zinc-700 object-cover"
                />
              ) : (
                <span
                  className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-900 text-sm font-medium text-zinc-400"
                  aria-hidden
                >
                  {(authorName || "?").slice(0, 1).toUpperCase()}
                </span>
              )}
              <div>
                <p className="text-[11px] uppercase tracking-[1.2px] text-zinc-600">Author</p>
                <p className="text-sm text-zinc-200">{authorName || "Instructor"}</p>
              </div>
            </div>
          ) : null}
          {category ? (
            <span className="mt-3 inline-flex rounded-none border border-neutral-600/30 bg-neutral-800/10 px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300/90">
              {category}
            </span>
          ) : null}
          {summary ? (
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-zinc-300">{summary}</p>
          ) : null}
          {landing?.workspaceGoal ? (
            <p className="mt-4 max-w-2xl text-sm leading-relaxed text-zinc-500">
              <span className="font-medium text-zinc-400">Goal · </span>
              {landing.workspaceGoal}
            </p>
          ) : null}
          {landing ? (
            <p className="mt-3 text-xs text-zinc-600">
              {landing.blockCount} map block
              {landing.blockCount === 1 ? "" : "s"}
              {isAycl ? " · Private fork after purchase" : " · Play copy on My Maps"}
            </p>
          ) : null}
        </div>

        <div
          className="console-copy space-y-3 rounded-none p-5"
          data-dashboard-map-detail-cta
        >
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            {isAycl ? "Get this workspace" : "Get this map"}
          </p>
          {error ? <p className="text-sm text-red-400">{error}</p> : null}
          <div className="rounded-none border border-zinc-700 bg-zinc-900/80 p-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p
                  className="text-sm font-medium text-white"
                  title={isAycl ? ayclOfferTooltip() : undefined}
                >
                  {isAycl ? ayclOfferLabel() : "Play copy"}
                </p>
                <p className="mt-1 text-[11px] leading-relaxed text-zinc-500">
                  {isAycl
                    ? offer?.description ||
                      "Your private copy of this workspace. Practice on the map and grow it from here."
                    : "Add a play copy to My Maps. Open a block and start a session from there."}
                </p>
              </div>
              {isAycl && priceLabel ? (
                <p className="text-right">
                  <span className="text-lg font-semibold text-white">{priceLabel}</span>
                </p>
              ) : null}
            </div>
            {inMyMaps ? (
              <button
                type="button"
                data-dashboard-add-to-my-maps
                data-dashboard-remove-from-my-maps=""
                disabled={actionsBusy}
                onClick={() => onRemove(detail.map)}
                className="mt-3 w-full rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {acquireBusy ? "Removing…" : REMOVE_FROM_MY_MAPS_LABEL}
              </button>
            ) : isAycl ? (
              <button
                type="button"
                data-dashboard-map-buy
                data-dashboard-add-to-my-maps
                disabled={actionsBusy}
                onClick={() => onBuy(detail.map)}
                className="mt-3 w-full rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {acquireBusy
                  ? "Redirecting…"
                  : `${ayclOfferCheckoutCta()}${priceLabel ? ` · ${priceLabel}` : ""}`}
              </button>
            ) : (
              <button
                type="button"
                data-dashboard-add-to-my-maps
                disabled={actionsBusy}
                onClick={() => onAdd(detail.map)}
                className="mt-3 w-full rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200 disabled:opacity-50"
              >
                {acquireBusy ? "Adding…" : ADD_TO_MY_MAPS_LABEL}
              </button>
            )}
            <button
              type="button"
              data-dashboard-map-try-now
              disabled={actionsBusy || busy || !landing || nodes.length === 0}
              onClick={() => onTry(detail.map)}
              className="mt-2 w-full rounded-sm border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:border-white/80 disabled:opacity-40"
            >
              {tryBusy ? "Starting…" : "Try Now"}
            </button>
          </div>
        </div>
      </section>

      <section data-dashboard-map-preview-section>
        <h2 className="mb-3 text-lg font-medium text-white">Workspace map</h2>
        <p className="mb-4 max-w-2xl text-sm text-zinc-500">
          A view-only snapshot of the learning map. Pan and zoom to look around.
        </p>
        <div
          className={
            mapIsFullscreen
              ? "fixed inset-0 z-50 h-screen w-screen overflow-hidden rounded-none border-0 bg-zinc-950"
              : "console-copy relative h-[min(28rem,55vh)] overflow-hidden rounded-none"
          }
          data-dashboard-map-preview
          data-aycl-map-snapshot=""
          data-map-view-only="true"
          data-aycl-map-fullscreen={mapIsFullscreen ? "true" : "false"}
        >
          <button
            type="button"
            data-dashboard-map-fullscreen-toggle
            title={mapIsFullscreen ? "Exit full screen" : "Full screen"}
            aria-label={mapIsFullscreen ? "Exit full screen" : "Full screen"}
            aria-pressed={mapIsFullscreen}
            onClick={() =>
              setMapFullscreen((open) => toggleAyclMapPreviewFullscreen(open))
            }
            className="console-copy absolute left-2 top-2 z-30 rounded-none px-2 py-1 text-[11px] font-medium text-zinc-200 hover:text-white"
          >
            {mapIsFullscreen ? "Exit" : "Full screen"}
          </button>
          {busy && !landing ? (
            <div className="flex h-full items-center justify-center">
              <LoadingStatusMessage message="Loading preview" />
            </div>
          ) : nodes.length === 0 ? (
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
              learnerMode
              workspaceId={landing?.workspaceId || detail.map.id}
              showProgress={false}
              onAddBlock={async () => {}}
              labels={MAP_PREVIEW_LABELS}
            />
          )}
        </div>
      </section>

      {isAycl ? (
        <section data-dashboard-map-detail-explore>
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
              <div>
                <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                  Exploratory questions
                </h3>
                <ul className="space-y-3">
                  {samples.questions.map((question, index) => (
                    <li
                      key={`q-${index}`}
                      className="console-copy rounded-none px-4 py-3 text-sm leading-relaxed text-zinc-300"
                    >
                      {question}
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <h3 className="mb-3 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                  Example exercises
                </h3>
                <ul className="space-y-3">
                  {samples.exercises.map((exercise, index) => (
                    <li
                      key={`ex-${index}`}
                      className="console-copy rounded-none px-4 py-3 text-sm leading-relaxed text-zinc-300"
                    >
                      {exercise}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          ) : (
            <p className="text-sm text-zinc-600">Samples could not be loaded.</p>
          )}
        </section>
      ) : (
        <section data-dashboard-map-detail-explore className="hidden" aria-hidden />
      )}
    </div>
  );
}
