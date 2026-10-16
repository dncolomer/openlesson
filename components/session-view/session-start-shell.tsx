"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_LABEL_CLASS } from "@/components/ui/console-frame";
import { cn } from "@/lib/utils";

/**
 * Shared Learn / Calibrate / Verify start frame: console chrome, then a
 * two-column stage (copy + controls left, aesthetic right).
 */
export function SessionStartShell({
  frameLabel = "Set",
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLElement> & {
  frameLabel?: ReactNode;
}) {
  return (
    <section
      data-session-start-shell=""
      data-console-frame=""
      {...rest}
      className={cn(
        "relative flex min-h-0 flex-1 flex-col overflow-hidden border border-white/40 bg-black",
        className,
      )}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      {frameLabel ? (
        <p data-console-frame-label="" className={`absolute left-3 top-2 z-[4] ${CONSOLE_LABEL_CLASS}`}>
          {frameLabel}
        </p>
      ) : null}
      <div className="relative z-[2] flex min-h-0 flex-1 flex-col pt-7">{children}</div>
    </section>
  );
}
