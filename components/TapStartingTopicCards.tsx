"use client";

import { aestheticImagesForSlots } from "@/lib/aesthetics";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import type { TapStartingTopic } from "@/lib/tap-score";

interface TapStartingTopicCardsProps {
  topics: TapStartingTopic[];
  isStarting?: boolean;
  startingTopicId?: string | null;
  onStartTopic: (topic: TapStartingTopic) => void;
  /** When set, first card is Practice First (no aesthetic image) in a 2×2 grid. */
  onPracticeFirst?: () => void;
  practiceTitle?: string;
  practiceSubtitle?: string;
  practiceStartLabel?: string;
  practiceStartingLabel?: string;
  loadingLabel?: string;
  startLabel?: string;
  startingLabel?: string;
}

function TopicCardSkeleton() {
  return (
    <div className="overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
      <div className="h-28 animate-pulse bg-neutral-900 sm:h-32" />
      <div className="space-y-2 p-3">
        <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-800" />
        <div className="h-3 w-full animate-pulse rounded bg-neutral-900" />
        <div className="h-8 w-24 animate-pulse rounded-full bg-neutral-800" />
      </div>
    </div>
  );
}

/**
 * Idle + loading labels occupy the same box so swapping text does not grow the
 * button and reflow the card (Practice → Starting… was shifting the 2×2 grid).
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

function PracticeFirstCard({
  isStarting,
  isThisStarting,
  onPracticeFirst,
  title,
  subtitle,
  startLabel,
  startingLabel,
}: {
  isStarting: boolean;
  isThisStarting: boolean;
  onPracticeFirst: () => void;
  title: string;
  subtitle: string;
  startLabel: string;
  startingLabel: string;
}) {
  return (
    <article
      data-tap-practice-first
      className="group flex flex-col overflow-hidden rounded-xl border border-cyan-400/35 bg-cyan-950/30 transition hover:border-cyan-300/55"
    >
      <div className="relative flex h-28 flex-col justify-end bg-gradient-to-br from-cyan-950/80 via-neutral-950 to-black p-3 sm:h-32">
        <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-cyan-300/80">Warm-up</p>
        <p className="mt-1 font-serif text-base leading-tight text-cyan-50">{title}</p>
      </div>
      <div className="flex flex-1 items-center justify-between gap-3 p-3">
        <p className="min-w-0 flex-1 text-xs leading-relaxed text-cyan-100/70">{subtitle}</p>
        <button
          type="button"
          disabled={isStarting}
          onClick={onPracticeFirst}
          aria-busy={isThisStarting}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full border border-cyan-300/40 bg-cyan-400/15 px-4 py-2 text-xs font-semibold text-cyan-50 transition hover:bg-cyan-400/25 disabled:cursor-wait disabled:opacity-70"
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
    <article className="group overflow-hidden rounded-xl border border-neutral-800/90 bg-neutral-950 transition hover:border-neutral-600">
      <div className="relative h-28 overflow-hidden sm:h-32">
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
          aria-busy={isThisStarting}
          className="inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-white px-4 py-2 text-xs font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-70"
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
  onPracticeFirst,
  practiceTitle = "Practice First",
  practiceSubtitle = "1-minute warm-up with full mechanics. PoW is flagged as Practice PoW.",
  practiceStartLabel = "Practice",
  practiceStartingLabel = "Starting…",
  loadingLabel = "Loading topics…",
  startLabel = "Start",
  startingLabel = "Starting…",
}: TapStartingTopicCardsProps) {
  const topicImages = aestheticImagesForSlots(3);
  const showPractice = typeof onPracticeFirst === "function";

  if (topics.length === 0) {
    return (
      <div className="mt-4">
        <div className="grid grid-cols-2 gap-3">
          {showPractice ? (
            <PracticeFirstCard
              isStarting={isStarting}
              isThisStarting={isStarting && startingTopicId === "practice"}
              onPracticeFirst={onPracticeFirst}
              title={practiceTitle}
              subtitle={practiceSubtitle}
              startLabel={practiceStartLabel}
              startingLabel={practiceStartingLabel}
            />
          ) : (
            <TopicCardSkeleton />
          )}
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

  const [first, second, third] = topics;

  return (
    <div className="mt-4 grid grid-cols-2 gap-3" data-tap-topic-grid={showPractice ? "2x2-practice" : "topics"}>
      {showPractice ? (
        <PracticeFirstCard
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === "practice"}
          onPracticeFirst={onPracticeFirst}
          title={practiceTitle}
          subtitle={practiceSubtitle}
          startLabel={practiceStartLabel}
          startingLabel={practiceStartingLabel}
        />
      ) : null}
      {first ? (
        <TopicCard
          topic={first}
          imageSrc={topicImages[0]}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === first.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
        />
      ) : null}
      {second ? (
        <TopicCard
          topic={second}
          imageSrc={topicImages[1]}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === second.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
        />
      ) : null}
      {third ? (
        <TopicCard
          topic={third}
          imageSrc={topicImages[2]}
          isStarting={isStarting}
          isThisStarting={isStarting && startingTopicId === third.id}
          onStartTopic={onStartTopic}
          startLabel={startLabel}
          startingLabel={startingLabel}
        />
      ) : null}
    </div>
  );
}
