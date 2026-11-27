"use client";

import type { CSSProperties, HTMLAttributes, ReactNode } from "react";
import { IleStartLoading } from "@/components/session-view/learn-start-loading";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { useI18n } from "@/lib/i18n";
import { sessionSidebarStyleCssVars } from "@/lib/session-sidebar-style";
import { useSessionSidebarStyle } from "@/lib/use-session-sidebar-style";
import { cn } from "@/lib/utils";

/**
 * Full-page wait shared by every session start, save, and route fallback.
 * With no children, the body is the tips plate. A caller that already mounts
 * that plate (field progress, a retry control) passes it as children.
 * The field matches the session console: black square, scan, corner ticks.
 * Org sidebar tokens restyle this the same way they restyle the 16rem rail.
 */
export function SessionPageLoading({
  message,
  children,
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement> & {
  message?: string;
  children?: ReactNode;
}) {
  const { t } = useI18n();
  const sidebarStyle = useSessionSidebarStyle();
  const styleVars = sessionSidebarStyleCssVars(sidebarStyle);
  return (
    <div
      data-session-page-loading=""
      data-session-page-loading-wash={sidebarStyle.backgroundImage ? "true" : undefined}
      data-console-frame=""
      {...rest}
      style={
        {
          ...styleVars,
          backgroundColor: sidebarStyle.tokens.background,
          borderColor: sidebarStyle.tokens.border,
          color: sidebarStyle.tokens.text,
          ...style,
        } as CSSProperties
      }
      className={cn(
        "relative flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden border border-white/40 bg-black",
        className,
      )}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <div className="relative z-[2] flex min-h-0 w-full flex-1 flex-col items-center justify-center px-6 py-10">
        {children ?? <IleStartLoading t={t} statusLabel={message} />}
      </div>
    </div>
  );
}
