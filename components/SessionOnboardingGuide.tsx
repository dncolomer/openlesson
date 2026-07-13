"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { translateWithLocale } from "@/lib/i18n";

type OnboardingVariant = "ile" | "tap";

export type SessionOnboardingGuideProps = {
  variant?: OnboardingVariant;
  /** Tutoring language for copy (falls back to English). */
  language?: string;
  /** Sidebar card (TAP briefing) vs centered float (Helios panel). */
  presentation?: "sidebar" | "floating";
  /** When true, step 3 shows a primary start/play control. */
  showStartAction?: boolean;
  onStart?: () => void;
  isStarting?: boolean;
  /** TAP-only: replaces the default step-3 play button (e.g. topic cards). */
  renderStep3Action?: () => ReactNode;
  /** TAP-only: hide the quote block on step 3 when showing topic cards. */
  hideStep3Quote?: boolean;
  /** Optional hero image for step 1 (TAP placeholder; overrides ILE video if set). */
  stepImages?: [string | undefined, string | undefined];
  /** Optional override for ILE step 1 grid-pan clip. */
  step1VideoSrc?: string;
  /** Optional override for step 2 thought-interface clip. */
  step2VideoSrc?: string;
  className?: string;
};

const STEP_COUNT = 3;
const STEP1_ILE_GRID_PAN_VIDEO = "/animations/grid_pan.mp4";
const STEP1_TAP_SPEAKING_VIDEO = "/animations/speaking.mp4";
const STEP2_THOUGHT_INTERFACE_VIDEO = "/animations/selective_interface.mp4";

function OnboardingQuote({ text, author }: { text: string; author?: string }) {
  const attribution = author?.trim();

  return (
    <figure className="relative mb-5 overflow-hidden rounded-xl border border-white/10 bg-gradient-to-br from-white/[0.06] via-white/[0.02] to-transparent px-6 py-6 sm:px-8 sm:py-7">
      <div
        className="pointer-events-none absolute left-3 top-3 sm:left-4 sm:top-4 font-serif text-[4.5rem] leading-none text-white/15 select-none"
        aria-hidden
      >
        &ldquo;
      </div>
      <div
        className="pointer-events-none absolute right-3 bottom-3 sm:right-4 sm:bottom-4 font-serif text-[4.5rem] leading-none text-white/15 select-none"
        aria-hidden
      >
        &rdquo;
      </div>
      <blockquote className="relative px-1 sm:px-2">
        <p className="pl-6 font-serif text-[1.05rem] italic leading-[1.65] tracking-tight text-white sm:pl-7 sm:text-lg sm:leading-[1.7]">
          {text}
        </p>
        {attribution ? (
          <figcaption className="mt-4 pl-6 text-[11px] font-medium uppercase tracking-[0.14em] text-white/75 sm:pl-7">
            <span className="text-white/40" aria-hidden>
              —
            </span>{" "}
            {attribution}
          </figcaption>
        ) : null}
      </blockquote>
      <div
        className="pointer-events-none absolute bottom-0 right-0 h-px w-2/3 bg-gradient-to-l from-white/20 to-transparent"
        aria-hidden
      />
    </figure>
  );
}

function StepVisual({
  alt,
  placeholderLabel,
  imageSrc,
  videoSrc,
  isActive = true,
}: {
  alt: string;
  placeholderLabel: string;
  imageSrc?: string;
  videoSrc?: string;
  isActive?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !videoSrc) return;
    if (isActive) {
      void video.play().catch(() => {});
      return;
    }
    video.pause();
    video.currentTime = 0;
  }, [isActive, videoSrc]);

  if (videoSrc) {
    return (
      <video
        ref={videoRef}
        src={videoSrc}
        autoPlay
        loop
        muted
        playsInline
        disablePictureInPicture
        controls={false}
        controlsList="nodownload noplaybackrate noremoteplayback"
        className="pointer-events-none h-full w-full object-cover"
        aria-label={alt}
      />
    );
  }

  if (imageSrc) {
    return (
      <img
        src={imageSrc}
        alt={alt}
        className="h-full w-full object-cover"
        decoding="async"
      />
    );
  }

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 bg-gradient-to-br from-neutral-900 via-neutral-950 to-black px-4 text-center">
      <LayoutGrid className="size-8 text-neutral-600" aria-hidden />
      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-600">
        {placeholderLabel}
      </span>
    </div>
  );
}

export function SessionOnboardingGuide({
  variant = "ile",
  language,
  presentation = "sidebar",
  showStartAction = false,
  onStart,
  isStarting = false,
  renderStep3Action,
  hideStep3Quote = false,
  stepImages,
  step1VideoSrc = STEP1_ILE_GRID_PAN_VIDEO,
  step2VideoSrc = STEP2_THOUGHT_INTERFACE_VIDEO,
  className = "",
}: SessionOnboardingGuideProps) {
  const [step, setStep] = useState(0);
  const lang = language ?? "en";
  const prefix = `onboardingGuide.${variant}`;

  const tt = (key: string, params?: Record<string, string | number>) =>
    translateWithLocale(lang, `${prefix}.${key}`, params);

  type GuideSlide =
    | {
        kind: "visual";
        title: string;
        body: string;
        imageAlt: string;
        imageSrc?: string;
        videoSrc?: string;
      }
    | {
        kind: "closing";
        title: string;
        body: string;
        quoteText: string;
        quoteAuthor: string;
      };

  const step1ImageSrc = stepImages?.[0];
  const step1Video = step1ImageSrc
    ? undefined
    : variant === "ile"
      ? step1VideoSrc
      : variant === "tap"
        ? STEP1_TAP_SPEAKING_VIDEO
        : undefined;

  const steps: GuideSlide[] = [
    {
      kind: "visual",
      title: tt("step1.title"),
      body: tt("step1.body"),
      imageAlt: tt("step1.imageAlt"),
      imageSrc: step1ImageSrc,
      videoSrc: step1Video,
    },
    {
      kind: "visual",
      title: tt("step2.title"),
      body: tt("step2.body"),
      imageAlt: tt("step2.imageAlt"),
      videoSrc: step2VideoSrc,
    },
    {
      kind: "closing",
      title: tt("step3.title"),
      body: tt("step3.body"),
      quoteText: tt("step3.quoteText"),
      quoteAuthor: tt("step3.quoteAuthor"),
    },
  ];

  const isLastStep = step === STEP_COUNT - 1;
  const startLabel = isStarting ? tt("step3.starting") : tt("step3.start");
  const isFloating = presentation === "floating";

  const guide = (
    <div
      className={`flex min-h-0 flex-col ${
        isFloating
          ? "max-h-[min(100%,46rem)] min-h-[34rem] w-full max-w-lg overflow-hidden rounded-2xl border border-white/10 bg-black/55 shadow-[0_24px_80px_rgba(0,0,0,0.45)] backdrop-blur-xl"
          : `flex-1 ${className}`
      }`}
    >
      <div
        className={`shrink-0 px-5 py-4 sm:px-6 ${
          isFloating ? "border-b border-white/10" : "border-b border-neutral-800/70"
        }`}
      >
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
              {tt("kicker")}
            </p>
            <h3 className="mt-1 text-sm font-medium text-neutral-100">{tt("title")}</h3>
          </div>
          <div className="flex items-center gap-1.5" aria-label={tt("progressLabel")}>
            {Array.from({ length: STEP_COUNT }, (_, index) => (
              <button
                key={index}
                type="button"
                onClick={() => setStep(index)}
                aria-label={tt("goToStep", { step: index + 1 })}
                aria-current={step === index ? "step" : undefined}
                className={`h-1.5 rounded-full transition-all ${
                  step === index ? "w-6 bg-neutral-200" : "w-1.5 bg-neutral-700 hover:bg-neutral-500"
                }`}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div
          className="flex h-full transition-transform duration-300 ease-out"
          style={{ transform: `translateX(-${step * 100}%)` }}
        >
          {steps.map((slide, index) => (
            <div
              key={index}
              className="flex h-full w-full shrink-0 flex-col overflow-y-auto px-5 py-5 pb-6 sm:px-6 sm:pb-7"
            >
              {slide.kind === "visual" ? (
                <div className="mb-4 aspect-[16/10] overflow-hidden rounded-xl border border-neutral-800 bg-neutral-950">
                  <StepVisual
                    imageSrc={slide.imageSrc}
                    videoSrc={slide.videoSrc}
                    alt={slide.imageAlt}
                    placeholderLabel={tt("imagePlaceholder")}
                    isActive={step === index}
                  />
                </div>
              ) : hideStep3Quote ? null : (
                <OnboardingQuote text={slide.quoteText} author={slide.quoteAuthor} />
              )}

              <h4 className="text-base font-medium text-white">{slide.title}</h4>
              <p className="mt-2 text-sm leading-relaxed text-neutral-400 whitespace-pre-line">
                {slide.body}
              </p>

              {index === 2 && renderStep3Action ? renderStep3Action() : null}
              {index === 2 && showStartAction && !renderStep3Action ? (
                <button
                  type="button"
                  onClick={onStart}
                  disabled={isStarting}
                  className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-neutral-950 transition hover:bg-neutral-100 disabled:cursor-wait disabled:opacity-70"
                >
                  {isStarting ? (
                    <svg className="size-4 animate-spin" fill="none" viewBox="0 0 24 24" aria-hidden>
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                      />
                    </svg>
                  ) : (
                    <svg className="size-4" fill="currentColor" viewBox="0 0 24 24" aria-hidden>
                      <path d="M8 5v14l11-7z" />
                    </svg>
                  )}
                  <span>{startLabel}</span>
                </button>
              ) : null}
            </div>
          ))}
        </div>
      </div>

      <div
        className={`shrink-0 flex items-center justify-between gap-3 px-5 py-4 sm:px-6 ${
          isFloating ? "border-t border-white/10" : "border-t border-neutral-800/70"
        }`}
      >
        <button
          type="button"
          onClick={() => setStep((current) => Math.max(0, current - 1))}
          disabled={step === 0}
          className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-800 px-3 py-2 text-xs font-medium text-neutral-300 transition hover:border-neutral-600 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {tt("back")}
        </button>
        <span className="font-mono text-[10px] tabular-nums text-neutral-600">
          {step + 1} / {STEP_COUNT}
        </span>
        {!isLastStep ? (
          <button
            type="button"
            onClick={() => setStep((current) => Math.min(STEP_COUNT - 1, current + 1))}
            className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs font-medium text-neutral-100 transition hover:border-neutral-500 hover:bg-neutral-800"
          >
            {tt("next")}
            <ChevronRight className="size-4" aria-hidden />
          </button>
        ) : (
          <div className="w-[72px]" aria-hidden />
        )}
      </div>
    </div>
  );

  if (isFloating) {
    return (
      <div className={`flex flex-1 items-center justify-center p-4 sm:p-6 ${className}`}>
        {guide}
      </div>
    );
  }

  return guide;
}