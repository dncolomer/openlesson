"use client";

import {
  resolveMapCellStatusIcon,
  type MapCellStatusIcon,
} from "@/lib/map-cell-chrome";
import type { BlockCreatorEffectKey } from "@/lib/block-creator-effects";

/** Occupied tiles: title + tick when Done, gear when this user has worked on it. */
export function MapCellStatusGlyph({
  status,
  showProgress,
  title,
  statusIcon = null,
}: {
  status: string;
  showProgress: boolean;
  title: string;
  statusIcon?: MapCellStatusIcon;
}) {
  const resolved = statusIcon ?? resolveMapCellStatusIcon(status, showProgress);
  return (
    <span className="flex max-w-full flex-col items-center gap-0.5">
      {resolved === "tick" ? (
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center text-neutral-900"
          data-ile-chapter-done-tick
          data-map-cell-done-tick
          aria-hidden
        >
          <svg viewBox="0 0 16 16" className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3.2 8.4 6.3 11.4 12.8 4.6" />
          </svg>
        </span>
      ) : resolved === "gear" ? (
        <span
          className="inline-flex h-3.5 w-3.5 items-center justify-center text-neutral-800"
          data-map-cell-self-progress-gear
          aria-hidden
        >
          <svg viewBox="0 0 20 20" className="h-3.5 w-3.5" fill="currentColor">
            <path
              fillRule="evenodd"
              clipRule="evenodd"
              d="M7.84 1.804A1 1 0 0 1 8.82 1h2.36a1 1 0 0 1 .98.804l.331 1.652a6.993 6.993 0 0 1 1.929 1.115l1.598-.54a1 1 0 0 1 1.186.447l1.18 2.044a1 1 0 0 1-.205 1.251l-1.267 1.113a7.047 7.047 0 0 1 0 2.228l1.267 1.113a1 1 0 0 1 .206 1.25l-1.18 2.045a1 1 0 0 1-1.187.447l-1.598-.54a6.993 6.993 0 0 1-1.929 1.115l-.33 1.652a1 1 0 0 1-.98.804H8.82a1 1 0 0 1-.98-.804l-.331-1.652a6.993 6.993 0 0 1-1.929-1.115l-1.598.54a1 1 0 0 1-1.186-.447l-1.18-2.044a1 1 0 0 1 .205-1.251l1.267-1.114a7.05 7.05 0 0 1 0-2.227L1.821 7.773a1 1 0 0 1-.206-1.25l1.18-2.045a1 1 0 0 1 1.187-.447l1.598.54A6.99 6.99 0 0 1 7.51 3.456l.33-1.652ZM10 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
            />
          </svg>
        </span>
      ) : null}
      <span className="line-clamp-3 text-[11px] font-medium leading-tight" data-map-cell-status="title">
        {title}
      </span>
    </span>
  );
}

/** Small lock badge for blocks with dependencies (lock-until and/or inbound DAG). */
export function BlockDependencyLockBadge({
  dependencyCount,
  currentlyLocked,
  learnerSpottable = false,
}: {
  dependencyCount: number;
  currentlyLocked: boolean;
  learnerSpottable?: boolean;
}) {
  if (dependencyCount <= 0) return null;
  const redLocked = learnerSpottable && currentlyLocked;
  return (
    <span
      className={`absolute bottom-1 left-1.5 z-[1] inline-flex items-center justify-center rounded px-0.5 py-px ${
        redLocked
          ? "text-rose-400"
          : currentlyLocked
            ? "text-neutral-300"
            : "text-neutral-400"
      }`}
      data-block-dependency-lock
      data-block-dependency-count={dependencyCount}
      data-block-dependency-locked={currentlyLocked ? "true" : "false"}
      data-learner-locked-icon={redLocked ? "true" : undefined}
      title={
        currentlyLocked
          ? `Locked until ${dependencyCount} prerequisite${dependencyCount === 1 ? "" : "s"} complete`
          : `Depends on ${dependencyCount} block${dependencyCount === 1 ? "" : "s"}`
      }
      aria-hidden
    >
      <svg
        className="h-3 w-3"
        fill={redLocked ? "currentColor" : "none"}
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        data-learner-lock-svg={redLocked ? "true" : undefined}
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M16.5 10.5V7.5a4.5 4.5 0 10-9 0v3m-.75 0h10.5a1.5 1.5 0 011.5 1.5v7.5a1.5 1.5 0 01-1.5 1.5H6.75a1.5 1.5 0 01-1.5-1.5v-7.5a1.5 1.5 0 011.5-1.5z"
        />
      </svg>
    </span>
  );
}

/** Small document badge for blocks with attached local context materials. */
export function BlockLocalContextDocBadge() {
  return (
    <span
      className="absolute bottom-1 left-1.5 z-[1] inline-flex items-center justify-center rounded px-0.5 py-px text-neutral-400"
      data-block-local-context-badge
      title="Has attached local context"
      aria-hidden
    >
      <svg
        className="h-3 w-3"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
        data-block-local-context-icon
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          d="M7 3.75h6.75L19 9v11.25A1.5 1.5 0 0117.5 21.75h-10.5A1.5 1.5 0 015.5 20.25V5.25A1.5 1.5 0 017 3.75z"
        />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 3.75V9H19" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 13.5h6M9 17h4.5" />
      </svg>
    </span>
  );
}

/** Flag badge for author starter blocks (`is_start`) — map-visible without Edit. */
export function BlockStarterFlagBadge() {
  return (
    <span
      className="absolute bottom-1 right-1.5 z-[1] inline-flex items-center justify-center rounded px-0.5 py-px text-neutral-300/95"
      data-block-starter-flag
      data-block-starter-badge
      title="Starter block"
      aria-label="Starter block"
    >
      <svg
        className="h-3 w-3"
        fill="currentColor"
        viewBox="0 0 24 24"
        data-block-starter-icon
        aria-hidden
      >
        <path d="M6 3.75v16.5a.75.75 0 01-1.5 0V3.75a.75.75 0 011.5 0z" />
        <path d="M6.75 4.5h8.1c.9 0 1.4.95.9 1.65L14.4 8.4l1.35 2.25c.5.7 0 1.65-.9 1.65H6.75V4.5z" />
      </svg>
    </span>
  );
}

export function BlockCreatorEffectsBadge({
  keys,
  learnerMode = false,
}: {
  keys: BlockCreatorEffectKey[];
  learnerMode?: boolean;
}) {
  if (keys.length === 0) return null;
  const title = keys
    .map((k) => (k === "dynamic" ? "Dynamic" : "Generator"))
    .join(" · ");
  return (
    <span
      className="absolute bottom-1 left-1/2 z-[1] flex -translate-x-1/2 max-w-[calc(100%-8px)] flex-wrap items-center justify-center gap-0.5 rounded bg-black/50 px-0.5 py-px"
      data-block-creator-effect-icons
      data-creator-effect-icon-keys={keys.join(",")}
      data-learner-mode={learnerMode ? "true" : undefined}
      title={title}
      aria-label={`Effects: ${title}`}
    >
      {keys.includes("dynamic") ? (
        <span
          className="inline-flex h-3 min-w-[0.75rem] items-center justify-center text-[10px] font-bold leading-none text-white/90"
          data-creator-effect-icon="dynamic"
          aria-hidden
        >
          ?
        </span>
      ) : null}
      {keys.includes("generator") ? (
        <svg
          className="h-2.5 w-2.5 text-white/90"
          data-creator-effect-icon="generator"
          fill="currentColor"
          viewBox="0 0 24 24"
          aria-hidden
        >
          <path d="M12 2.5l1.2 5.1 3.6-3.9-1.1 5.4 5.3-.4-4.2 3.3 4.2 3.3-5.3-.4 1.1 5.4-3.6-3.9L12 21.5l-1.2-5.1-3.6 3.9 1.1-5.4-5.3.4 4.2-3.3-4.2-3.3 5.3.4-1.1-5.4 3.6 3.9L12 2.5z" />
        </svg>
      ) : null}
    </span>
  );
}

export function BlockGeneratorTargetSparkBadge() {
  return (
    <span
      className="absolute right-1 top-1 z-[2] inline-flex items-center justify-center rounded bg-white/20 p-0.5 text-white shadow ring-1 ring-white/40"
      data-block-generator-target-spark
      title="Will be generated"
      aria-label="Generator target"
    >
      <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
        <path d="M12 2.5l1.2 5.1 3.6-3.9-1.1 5.4 5.3-.4-4.2 3.3 4.2 3.3-5.3-.4 1.1 5.4-3.6-3.9L12 21.5l-1.2-5.1-3.6 3.9 1.1-5.4-5.3.4 4.2-3.3-4.2-3.3 5.3.4-1.1-5.4 3.6 3.9L12 2.5z" />
      </svg>
    </span>
  );
}

export function BlockPracticeOptionsBadge({
  keys,
}: {
  keys: Array<"explore" | "drill" | "dialog" | "solo" | "open" | "timed">;
}) {
  if (keys.length === 0) return null;
  const displayKeys = keys.filter((k) => {
    if (k === "open" && keys.includes("dialog")) return false;
    if (k === "timed" && keys.includes("solo")) return false;
    return true;
  });
  const title = displayKeys
    .map((k) =>
      k === "explore"
        ? "Explore"
        : k === "drill"
          ? "Drill"
          : k === "dialog" || k === "open"
            ? "With AI"
            : "Solo",
    )
    .join(" · ");
  return (
    <span
      className="absolute left-1 top-1 z-[1] inline-flex max-w-[calc(100%-8px)] flex-wrap items-center gap-0.5 rounded bg-black/45 px-0.5 py-px"
      data-block-practice-icons
      data-practice-icon-keys={keys.join(",")}
      title={title}
      aria-label={`Practice: ${title}`}
    >
      {keys.includes("explore") ? (
        <svg
          className="h-2.5 w-2.5 text-white"
          data-practice-icon="explore"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <circle cx="12" cy="12" r="8" />
          <path strokeLinecap="round" d="M14 10l-2 5-5 2 2-5 5-2z" />
        </svg>
      ) : null}
      {keys.includes("drill") ? (
        <svg
          className="h-2.5 w-2.5 text-white"
          data-practice-icon="drill"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="3.5" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
        </svg>
      ) : null}
      {keys.includes("dialog") || keys.includes("open") ? (
        <svg
          className="h-2.5 w-2.5 text-white"
          data-practice-icon="dialog"
          data-practice-icon-legacy="open"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M7 8h10M7 12h6m-8 7l2.5-2.5H17a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v7a2 2 0 002 2h.5L5 19z"
          />
        </svg>
      ) : null}
      {keys.includes("solo") || keys.includes("timed") ? (
        <svg
          className="h-2.5 w-2.5 text-white"
          data-practice-icon="solo"
          data-practice-icon-legacy="timed"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M15.232 5.232l3.536 3.536M4 20h4.5L19.5 9 15 4.5 4 15.5V20z"
          />
        </svg>
      ) : null}
    </span>
  );
}
