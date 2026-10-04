"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { CONSOLE_GRID_STYLE } from "@/components/ui/console-frame";
import { cn } from "@/lib/utils";

/**
 * Full-page centered wait shared by Learn, Prepare, Drill, conversational TAP,
 * and Verify. Learn's start tips render as children. Saving waits pass message.
 * The field matches the session console: black square, scan, corner ticks, grid.
 */
export function SessionPageLoading({
  message,
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  message?: string;
  children?: ReactNode;
}) {
  return (
    <div
      data-session-page-loading=""
      data-console-frame=""
      {...rest}
      className={cn(
        "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border border-white/40 bg-black",
        className,
      )}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div aria-hidden className="pointer-events-none absolute inset-0" style={CONSOLE_GRID_STYLE} />
      <div className="relative z-[2] flex min-h-0 w-full flex-1 flex-col items-center justify-center px-6 py-10">
        {message ? <LoadingStatusMessage message={message} className="text-center" /> : null}
        {children}
      </div>
    </div>
  );
}
