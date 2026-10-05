"use client";

import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import type { IleDockChipStatus } from "@/lib/ile-work-dock-status";
import {
  FALLBACK_AESTHETIC_IMAGES,
  resolveIleWorkAestheticImage,
  sessionTopicCardStill,
} from "@/lib/aesthetics";
import { SESSION_TOPIC_CARD_REM, formatLearnElapsedClock } from "@/lib/session-sidebar";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { useSurfaceAestheticImages } from "@/lib/use-surface-aesthetic-images";
import type { SessionViewTranslate } from "@/components/session-view/types";

export type SessionTopicCardInput = {
  id?: string;
  label?: string;
  keyword?: string;
  description?: string;
  focused?: boolean;
  image?: string;
};

/** One chapter for the sidebar. Extra labels are not shown. */
export function sessionSidebarTopic(
  labels: readonly SessionTopicCardInput[] | null | undefined,
): { id: string; title: string; image?: string } {
  const row = (labels ?? []).find((item) => item.focused) ?? (labels ?? [])[0];
  if (!row) return { id: "topic", title: "Topic" };
  const title = String(row.keyword || "").trim() || String(row.label || "").trim() || "Topic";
  const id = String(row.id || "").trim() || "topic";
  const image = String(row.image || "").trim();
  const description = String(row.description || "").trim();
  return {
    id,
    title,
    ...(image ? { image } : {}),
    ...(description ? { description } : {}),
  };
}

/** Elapsed Learn clock. It does not clear the board. */
export function LearnElapsedTimer({ startedAt }: { startedAt?: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const start = startedAt ? new Date(startedAt).getTime() : now;
  const elapsed = Number.isFinite(start) ? now - start : 0;
  return (
    <span
      data-learn-elapsed-timer
      className="font-mono text-lg font-semibold uppercase tracking-wider text-white tabular-nums"
      title="Time worked"
    >
      {formatLearnElapsedClock(elapsed)}
    </span>
  );
}

/** Silent radar loop for the topic card. The still stays the default. */
export const SESSION_TOPIC_CARD_LOOP = "/aesthetics/session-topic-loop.mp4";

const SessionTopicCardTimerContext = createContext<ReactNode>(null);

/** Sidebar clock rendered inside the topic card, above the chapter name. */
export function SessionTopicCardTimerProvider({
  timer,
  children,
}: {
  timer: ReactNode;
  children: ReactNode;
}) {
  return (
    <SessionTopicCardTimerContext.Provider value={timer}>
      {children}
    </SessionTopicCardTimerContext.Provider>
  );
}

/**
 * Cover for the session's one chapter. It does not switch chapters.
 * Loop swaps the still for the radar video and back.
 */
export function SessionTopicCard({
  id,
  title,
  image,
  description,
  customUrls,
  systemImages,
}: {
  id: string;
  title: string;
  image?: string | null;
  description?: string | null;
  customUrls?: readonly string[] | null;
  systemImages?: readonly string[] | null;
}) {
  const explicitCustom = customUrls && customUrls.length > 0 ? customUrls : null;
  const explicitSystem = systemImages && systemImages.length > 0 ? systemImages : null;
  const surface = useSurfaceAestheticImages(explicitCustom ?? explicitSystem ?? undefined);
  const fetchedCustom =
    !explicitCustom &&
    !explicitSystem &&
    surface.source === "packages" &&
    surface.images.length > 0 &&
    surface.images.every((url) => !url.startsWith("/aesthetics/"))
      ? surface.images
      : [];
  const resolvedCustom = explicitCustom ?? fetchedCustom;
  const poolsPending = !explicitCustom && !explicitSystem && surface.source === "pending";
  const resolvedSystem =
    resolvedCustom.length > 0
      ? []
      : explicitSystem
        ? explicitSystem
        : poolsPending
          ? []
          : surface.source === "fallback" || surface.source === "packages"
            ? surface.images
            : [];
  const still = sessionTopicCardStill({
    id,
    assigned: image,
    customUrls: resolvedCustom,
    systemImages: resolvedSystem,
    allowSystemFallback: !poolsPending,
  });
  const heading = title.trim() || "Topic";
  const timer = useContext(SessionTopicCardTimerContext);
  const height = `${SESSION_TOPIC_CARD_REM}rem`;
  const videoRef = useRef<HTMLVideoElement>(null);
  const [mode, setMode] = useState<"image" | "video">("image");
  const [descriptionOpen, setDescriptionOpen] = useState(false);
  const fullDescription = String(description || "").trim();
  useEffect(() => {
    const node = videoRef.current;
    if (!node) return;
    if (mode === "video") void node.play().catch(() => undefined);
    else node.pause();
  }, [mode]);
  return (
    <div
      data-session-topic-card={id}
      data-session-topic-card-static="true"
      className="relative w-full min-w-0 max-w-full shrink-0 overflow-hidden border-b border-white/50 bg-black"
      style={{ height, minHeight: height }}
    >
      <span
        data-session-topic-card-image
        data-ile-chapter-chip-image
        aria-hidden
        className={`absolute inset-0 bg-cover bg-center ${mode === "video" ? "hidden" : ""}`}
        style={still ? { backgroundImage: `url(${still})` } : undefined}
      />
      <video
        ref={videoRef}
        data-session-topic-card-video=""
        src={SESSION_TOPIC_CARD_LOOP}
        muted
        loop
        playsInline
        preload="metadata"
        className={`absolute inset-0 h-full w-full object-cover grayscale ${mode === "video" ? "" : "hidden"}`}
      />
      <button
        type="button"
        data-session-topic-card-media={mode}
        aria-pressed={mode === "video"}
        onClick={() => setMode((current) => (current === "image" ? "video" : "image"))}
        className="pointer-events-auto absolute right-2 top-4 z-30 rounded-none border border-white/70 bg-black/85 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-white hover:bg-white hover:text-black"
      >
        {mode === "image" ? "Loop" : "Still"}
      </button>
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-black/25"
      />
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <span
        aria-hidden
        className="pointer-events-none absolute inset-x-8 top-0 z-10 h-1.5"
        style={{
          backgroundImage:
            "repeating-linear-gradient(90deg, rgba(255,255,255,0.75) 0 1px, transparent 1px 7px)",
        }}
      />
      <span className="pointer-events-none absolute left-5 top-2 z-10 font-mono text-[9px] uppercase tracking-[0.34em] text-white">
        01
      </span>
      <span className="relative z-10 flex h-full w-full flex-col items-start justify-end gap-1 px-2 pb-2">
        {timer}
        {fullDescription ? (
          <button
            type="button"
            data-session-topic-card-description
            aria-expanded={descriptionOpen}
            onClick={() => setDescriptionOpen((open) => !open)}
            className="pointer-events-auto rounded-none border border-white/70 bg-black/85 px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-white hover:bg-white hover:text-black"
          >
            {descriptionOpen ? "Close" : "Description"}
          </button>
        ) : null}
        <span
          data-session-topic-card-title
          className="line-clamp-3 max-w-full min-w-0 self-start text-left border border-white/55 bg-black/80 px-2 py-1 font-mono text-base font-semibold uppercase leading-tight tracking-[0.14em] text-white"
        >
          {heading}
        </span>
      </span>
      {descriptionOpen && fullDescription ? (
        <div
          data-session-topic-description
          className="absolute inset-0 z-20 overflow-y-auto bg-black/95 px-3 pb-3 pt-8 text-left"
        >
          <button
            type="button"
            data-session-topic-description-close
            onClick={() => setDescriptionOpen(false)}
            className="absolute right-2 top-2 rounded-none border border-white/70 bg-black px-1.5 py-0.5 font-mono text-[8px] uppercase tracking-[0.22em] text-white hover:bg-white hover:text-black"
          >
            Close
          </button>
          <p className="font-sans text-sm font-normal normal-case leading-relaxed tracking-normal text-white">
            {fullDescription}
          </p>
        </div>
      ) : null}
    </div>
  );
}

export type IleWorkDockLabel = {
  id: string;
  label: string;
  keyword?: string;
  focused?: boolean;
  status?: IleDockChipStatus;
  image?: string;
};

export function IleWorkDockChip({
  work,
  expanded = false,
  compact = false,
  fill = false,
  aestheticImages = [],
  onClick,
  caption,
}: {
  work: IleWorkDockLabel;
  expanded?: boolean;
  compact?: boolean;
  /** Stretch to the grid cell. The sidebar dock uses this so chips do not form a scrolling row. */
  fill?: boolean;
  aestheticImages?: readonly string[];
  onClick?: () => void;
  caption?: string;
}) {
  const chipSize = compact ? "h-16 w-[5.5rem]" : "h-24 w-[7rem]";
  const sizeClass = fill ? "h-24 w-full min-w-0" : chipSize;
  const surface = useSurfaceAestheticImages(aestheticImages);
  const dockImages =
    surface.source === "fallback" ? FALLBACK_AESTHETIC_IMAGES : surface.images;
  const chipImage = resolveIleWorkAestheticImage({
    id: work.id,
    assigned: work.image,
    images: surface.source === "pending" ? undefined : dockImages,
  });
  const keyword = work.keyword?.trim();
  const status = work.status ?? "idle";
  const interactive = typeof onClick === "function";
  const className = `relative flex ${sizeClass} ${fill ? "max-w-full" : "shrink-0"} flex-col items-stretch justify-end overflow-hidden rounded-none border ${
    expanded
      ? "border-white shadow-[0_0_0_1px_#fff,0_12px_28px_rgba(0,0,0,0.55)]"
      : "border-white/25 hover:border-white/70"
  }`;
  const body = (
    <>
      <span
        data-ile-chapter-chip-image
        aria-hidden
        className="absolute inset-0 bg-cover bg-center"
        style={{ backgroundImage: `url(${chipImage})` }}
      />
      <span
        aria-hidden
        className={`absolute inset-0 ${
          expanded
            ? "bg-gradient-to-t from-black/80 via-black/25 to-black/5"
            : "bg-gradient-to-t from-black/90 via-black/50 to-black/20"
        }`}
      />
      {status === "attention" && !expanded ? (
        <span
          data-ile-chapter-chip-attention
          title="Needs attention"
          className="absolute right-1 top-1 z-20 flex size-5 items-center justify-center border border-amber-300/80 bg-black/75 text-amber-300"
        >
          <AlertTriangle className="size-3" strokeWidth={2.4} aria-hidden />
          <span className="sr-only">Needs attention</span>
        </span>
      ) : null}
      <span className="relative z-10 flex flex-col items-start px-1.5 pb-1.5 pt-6">
        <span className="max-w-full truncate font-mono text-[9px] uppercase tracking-wider text-white/75">
          {work.label}
        </span>
        {keyword ? (
          <span
            data-ile-chapter-chip-keyword
            className="line-clamp-2 max-w-full text-left font-mono text-[11px] font-semibold uppercase leading-tight tracking-wide text-white"
          >
            {keyword}
          </span>
        ) : null}
        <span className="font-mono text-[9px] uppercase tracking-wider text-white/70">
          {caption ?? (expanded ? "Open" : "Docked")}
        </span>
      </span>
      {status === "loading" ? (
        <span
          data-ile-chapter-chip-loading
          aria-hidden
          className="absolute inset-x-0 bottom-0 z-20 h-1 overflow-hidden bg-white/15"
        >
          <span className="block h-full w-1/3 animate-ile-dock-indeterminate bg-white" />
        </span>
      ) : null}
    </>
  );
  if (interactive) {
    return (
      <button
        type="button"
        data-ile-open-work-chip={work.id}
        data-ile-open-work-focused={work.focused ? "true" : undefined}
        data-ile-chapter-minimized={expanded ? undefined : "true"}
        data-ile-chapter-chip-status={status}
        onClick={onClick}
        title={keyword ? `${work.label} · ${keyword}` : work.label}
        className={className}
      >
        {body}
      </button>
    );
  }
  return (
    <div
      data-ile-open-work-chip={work.id}
      data-ile-chapter-chip-status={status}
      title={keyword ? `${work.label} · ${keyword}` : work.label}
      className={className}
    >
      {body}
    </div>
  );
}

/** One chosen topic, drawn as the static sidebar card. */
export function SessionTopicChapter({
  id,
  keyword,
  image,
  customUrls,
  systemImages,
}: {
  id: string;
  keyword: string;
  image?: string | null;
  customUrls?: readonly string[] | null;
  systemImages?: readonly string[] | null;
}) {
  const title = keyword.trim() || "Topic";
  return (
    <div data-session-topic-chapter={id} className="w-full min-w-0">
      <SessionTopicCard
        id={id}
        title={title}
        image={image}
        customUrls={customUrls}
        systemImages={systemImages}
      />
    </div>
  );
}

/** One static topic. Extra labels are not drawn, and the card is not a control. */
export function IleWorkDockBar({
  openWorkLabels,
}: {
  t?: SessionViewTranslate;
  heliosOpen?: boolean;
  openWorkLabels: IleWorkDockLabel[];
  onFocusOpenWork?: (id: string) => void;
  aestheticImages?: string[];
  compact?: boolean;
}) {
  const topic = sessionSidebarTopic(openWorkLabels);
  return (
    <div
      data-ile-work-dock-bar
      data-ile-chapter-dock-chapters
      data-ile-open-work-tabs={openWorkLabels.length > 0 ? "" : undefined}
      className="pointer-events-auto w-full min-w-0 max-w-full gap-1.5 border border-white/20 bg-neutral-950/95 p-2"
    >
      <SessionTopicCard id={topic.id} title={topic.title} image={topic.image} />
    </div>
  );
}
