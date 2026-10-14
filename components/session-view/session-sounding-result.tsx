import type { ReactNode } from "react";
import {
  soundingResultPresentation,
  type SoundingClassification,
} from "@/lib/calibrate-sounding";

/**
 * Left pane of the sounding result split. Centers the console plate
 * vertically; extra space on the sides keeps the border off the image.
 * my-auto (not justify-center) so a tall plate still scrolls from the top.
 */
export function SoundingFinishedStage({ children }: { children: ReactNode }) {
  return (
    <div
      data-sounding-finished-stage=""
      className="flex min-h-0 flex-col overflow-y-auto px-6 py-8 sm:px-10 lg:order-1"
    >
      <div className="my-auto w-full">{children}</div>
    </div>
  );
}

export function SessionSoundingResult({
  classification,
}: {
  classification: SoundingClassification | null;
}) {
  const presentation = soundingResultPresentation(classification);
  if (!presentation) return null;
  return (
    <div
      data-session-sounding-result=""
      data-sounding-band={classification?.band}
      className="mt-6 w-full max-w-lg text-left"
    >
      {presentation.depthLabel ? (
        <p
          data-sounding-coverage-depth={classification?.coverageDepth}
          className="font-mono text-[10px] uppercase tracking-[0.18em] text-neutral-400"
        >
          {presentation.depthLabel}
        </p>
      ) : (
        <span data-sounding-coverage-depth={classification?.coverageDepth} className="hidden" />
      )}
      {presentation.note ? (
        <p className="mt-3 text-sm leading-relaxed text-neutral-400">{presentation.note}</p>
      ) : null}
    </div>
  );
}
