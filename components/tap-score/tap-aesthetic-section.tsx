"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * TAP section that may carry the aesthetic image as a local background.
 * Used for briefing shortcuts and live Thought Memory only.
 */
export function TapAestheticSection({
  bgImage,
  className,
  children,
  kind,
}: {
  bgImage?: string | null;
  className?: string;
  children: ReactNode;
  kind: "shortcuts" | "thought-memory" | "solo-stacks" | "convo-stash";
}) {
  return (
    <div
      data-tap-aesthetic-section={kind}
      className={cn(
        "relative flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#0b0b0b]",
        className,
      )}
    >
      {bgImage ? (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url(${bgImage})` }}
          />
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[#0b0b0b]/78"
          />
        </>
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
