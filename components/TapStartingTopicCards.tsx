"use client";

import { aestheticImagesForSlots } from "@/lib/aesthetics";
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

function TopicCardSkeleton({ wide = false }: { wide?: boolean }) {
  return (
    <div
      className={`overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950 ${wide ? "col-span-2" : ""}`}
    >
      <div className="h-28 animate-pulse bg-neutral-900 sm:h-32" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800" />
        <div className="h-3 w-full animate-pulse rounded bg-neutral-900" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-neutral-800" />
      </div>
    </div>
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
  wide = false,
}: {
  topic: TapStartingTopic;
  imageSrc: string;
  isStarting: boolean;
  isThisStarting: boolean;
  onStartTopic: (topic: TapStartingTopic) => void;
  startLabel: string;
  startingLabel: string;
  wide?: boolean;
}) {
  return (
    <article
      className={`group overflow-hidden rounded-xl border border-neutral-800/90 bg-neutral-950 transition hover:border-neutral-600 ${
        wide ? "col-span-2" : ""
      }`}
    >
      <div className={`relative overflow-hidden ${wide ? "h-32 sm:h-36" : "h-28 sm:h-32"}`}>
        <div
          className="absolute inset-0 scale-105 bg-cover bg-center transition duration-500 group-hover:scale-110"
          style={{ backgroundImage: `url(${imageSrc})` }}
          role="img"
          aria-label=""
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black via-black/55 to-black/15" />
        <div className="absolute inset-x-0 bottom-0 p-3">
          <p className="font-serif text-base leading-tight text-white">{topic.title}</p>
        </div>
      </div>
      <div className="flex items-center justify-between gap-3 p-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-neutral-400">{topic.subtitle}</p>
        <button
          type="button"
          disabled={isStarting}
          onClick={() => onStartTopic(topic)}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-70"
        >
          {isThisStarting ? (
            <svg className="size-3.5 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
          ) : (
            <svg className="size-3.5" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
              <path d="M8 5v14l11-7z" />
            </svg>
          )}
          <span>{isThisStarting ? startingLabel : startLabel}</span>
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
  const topicImages = aestheticImagesForSlots(3);

  if (topics.length === 0) {
    return (
      <div className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          <TopicCardSkeleton />
          <TopicCardSkeleton />
          <TopicCardSkeleton wide />
        </div>
        <p className="mt-3 text-center text-xs text-neutral-500">{loadingLabel}</p>
      </div>
    );
  }

  const [topLeft, topRight, bottom] = topics;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3">
      {topLeft ? (
        <TopicCard
          topic={topLeft}
          imageSrc={topicImages[0]}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === topLeft.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
        />
      ) : null}
      {topRight ? (
        <TopicCard
          topic={topRight}
          imageSrc={topicImages[1]}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === topRight.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
        />
      ) : null}
      {bottom ? (
        <TopicCard
          topic={bottom}
          imageSrc={topicImages[2]}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === bottom.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
          wide
        />
      ) : null}
    </div>
  );
}