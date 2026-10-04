"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS } from "@/components/ui/console-frame";
import { cn } from "@/lib/utils";

/**
 * One finished-session stack: optional kicker, title, body, then primary
 * content (children) and the primary action. Each flow keeps its own copy
 * and outcome markers.
 *
 * Short stacks center with my-auto. justify-center on this scroller hides
 * the title once the stack is taller than the stage: the overflow sits above
 * the scroll origin and scrollTop cannot reach it. A wide report fills the
 * stage instead, so its fillHeight body scrolls under a visible title.
 */
export function SessionFinishedScreen({
  kicker,
  title,
  body,
  actions,
  children,
  wide = false,
  overlay = false,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  kicker?: ReactNode;
  title: ReactNode;
  body?: ReactNode;
  actions?: ReactNode;
  wide?: boolean;
  overlay?: boolean;
}) {
  const fillStage = wide && children != null && children !== false;
  return (
    <section
      data-session-finished-screen=""
      data-session-finished-fill={fillStage ? "true" : "false"}
      {...rest}
      className={cn(
        "relative border border-white/40 bg-black",
        overlay
          ? "fixed inset-0 z-[180] flex flex-col items-center overflow-y-auto px-6 py-10 text-center text-white"
          : "flex min-h-0 flex-1 flex-col items-center overflow-y-auto px-6 py-10 text-center text-white",
        fillStage && "overflow-hidden px-0 py-0",
        className,
      )}
      data-console-frame=""
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div
        className={cn(
          "relative z-[2] flex w-full flex-col items-center",
          fillStage
            ? "h-full min-h-0 max-w-4xl flex-1 overflow-hidden px-6 py-10"
            : "my-auto max-w-xl",
        )}
      >
        <p data-console-frame-label="" className={`mb-3 ${CONSOLE_LABEL_CLASS}`}>
          End
        </p>
        {kicker ? (
          <p className="shrink-0 font-mono text-[10px] uppercase tracking-[0.16em] text-neutral-300/80">
            {kicker}
          </p>
        ) : null}
        <h1 className="mt-2 shrink-0 text-2xl font-medium text-neutral-100 sm:text-3xl">{title}</h1>
        {body ? (
          <div className="mt-4 max-w-lg shrink-0 whitespace-pre-line text-sm leading-relaxed text-neutral-300 sm:text-base">
            {body}
          </div>
        ) : null}
        {children}
        {actions ? (
          <div className="mt-8 flex shrink-0 flex-wrap items-center justify-center gap-2">{actions}</div>
        ) : null}
      </div>
    </section>
  );
}
