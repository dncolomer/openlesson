"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { IleStartLoading } from "@/components/session-view/learn-start-loading";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { useI18n } from "@/lib/i18n";
import { CONSOLE_GRID_STYLE } from "@/components/ui/console-frame";
import { cn } from "@/lib/utils";

/**
 * Full-page wait shared by every session start, save, and route fallback.
 * With no children, the body is the tips plate. A caller that already mounts
 * that plate (field progress, a retry control) passes it as children.
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
  const { t } = useI18n();
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
        {children ?? <IleStartLoading t={t} statusLabel={message} />}
      </div>
    </div>
  );
}
