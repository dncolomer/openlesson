"use client";

import { aestheticImagesForSlots } from "@/lib/aesthetics";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import type { TapStartingTopic } from "@/lib/tap-score";

interface TapStartingTopicCardsProps {
  topics: TapStartingTopic[];
  isStarting?: boolean;
  startingTopicId?: string | null;
  onStartTopic: (topic: TapStartingTopic) => void;
  loadingLabel?: string;
  startLabel?: string;
  startingLabel?: string;
}

function TopicCardSkeleton() {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-none border border-neutral-800 bg-neutral-950">
      <div className="h-28 animate-pulse bg-neutral-900 sm:h-32" />
      <div className="flex flex-1 flex-col gap-3 p-3">
        <div className="space-y-2">
          <div className="h-3 w-full animate-pulse rounded-none bg-neutral-900" />
          <div className="h-3 w-4/5 animate-pulse rounded-none bg-neutral-900" />
        </div>
        <div className="mt-auto h-8 w-24 animate-pulse rounded-none bg-neutral-800" />
      </div>
    </div>
  );
}

/**
 * Idle + loading labels occupy the same box so swapping text does not grow the
 * button and reflow the card.
 */
function StableStartButtonLabel({
  idle,
  busy,
  isBusy,
}: {
  idle: string;
  busy: string;
  isBusy: boolean;
}) {
  return (
    <span className="relative inline-grid place-items-center text-center" data-stable-start-label>
      <span className={`col-start-1 row-start-1 ${isBusy ? "invisible" : ""}`} aria-hidden={isBusy}>
        {idle}
      </span>
      <span className={`col-start-1 row-start-1 ${isBusy ? "" : "invisible"}`} aria-hidden={!isBusy}>
        {busy}
      </span>
    </span>
  );
}

function TopicCard({
  topic,
  imageSrc,
  isStarting,
  isThisStarting,
  onStartTopic,
  startLabel,
  startingLabel,
}: {
  topic: TapStartingTopic;
  imageSrc: string;
  isStarting: boolean;
  isThisStarting: boolean;
  onStartTopic: (topic: TapStartingTopic) => void;
  startLabel: string;
  startingLabel: string;
}) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-none border border-neutral-800/90 bg-neutral-950 transition hover:border-neutral-600">
      <div className="relative h-28 overflow-hidden sm:h-32">
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center transition duration-500 group-hover:scale-110"
          style={{ backgroundImage: `url(${imageSrc})` }}
          role="img"
          aria-label=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="line-clamp-2 font-serif text-base leading-tight text-white">{topic.title}</p>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-3 p-3">
        <p className="line-clamp-2 text-xs leading-snug text-neutral-400">{topic.subtitle}</p>
        <button
          type="button"
          disabled={isStarting}
          onClick={() => onStartTopic(topic)}
          aria-busy={isThisStarting}
          className="mt-auto inline-flex w-full items-center justify-center gap-1.5 rounded-none bg-white px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-70"
        >
          {isThisStarting ? (
            <svg className="size-3.5 shrink-0 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="size-3.5 shrink-0" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          <StableStartButtonLabel idle={startLabel} busy={startingLabel} isBusy={isThisStarting} />
        </button>
      </div>
    </article>
  );
}

export function TapStartingTopicCards({
  topics,
  isStarting = false,
  startingTopicId = null,
  onStartTopic,
  loadingLabel = "Loading topics…",
  startLabel = "Start",
  startingLabel = "Starting…",
}: TapStartingTopicCardsProps) {
  const topicImages = aestheticImagesForSlots(Math.max(topics.length, 3));

  if (topics.length === 0) {
    return (
      <div className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <TopicCardSkeleton />
          <TopicCardSkeleton />
          <TopicCardSkeleton />
        </div>
        <div className="mt-3 flex justify-center">
          <LoadingStatusMessage size="sm" tone="subtle" message={loadingLabel} />
        </div>
      </div>
    );
  }

  return (
    <div className="mt-4 grid grid-cols-2 gap-3" data-tap-topic-grid="topics">
      {topics.map((topic, index) => (
        <TopicCard
          key={topic.id || `topic-${index}`}
          topic={topic}
          imageSrc={topicImages[index] ?? topicImages[0] ?? ""}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === topic.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
        />
      ))}
    </div>
  );
}
