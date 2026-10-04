import type { HTMLAttributes, ReactNode } from "react";
import { SessionConsoleMarks, SessionConsoleScan } from "@/components/session-view/session-console-marks";
import { cn } from "@/lib/utils";

/** Same hairline the session rail uses. Square, black, white edge. */
export const CONSOLE_FRAME_CLASS = "relative border border-white/40 bg-black";

export const CONSOLE_LABEL_CLASS =
  "pointer-events-none font-mono text-[9px] uppercase tracking-[0.28em] text-white/50";

/** Faint field grid from the session rail. No color wash. */
export const CONSOLE_GRID_STYLE = {
  backgroundImage:
    "linear-gradient(rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.05) 1px, transparent 1px)",
  backgroundSize: "16px 16px",
} as const;

/**
 * Background field for public and marketing pages. Sits under page copy.
 * Corner brackets and a short index match the session rail.
 */
export function PublicConsoleWash({
  className,
  style,
  ...rest
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-console-field=""
      aria-hidden
      {...rest}
      className={cn("pointer-events-none fixed inset-0 z-[1]", className)}
      style={{ ...CONSOLE_GRID_STYLE, ...style }}
    >
      <SessionConsoleScan />
      <SessionConsoleMarks />
      <p data-console-frame-label="" className={`absolute bottom-3 left-3 z-[3] ${CONSOLE_LABEL_CLASS}`}>
        01
      </p>
    </div>
  );
}

/**
 * Panel frame: hairline, corner brackets, faint scan, optional mono index.
 * Body copy stays in the children.
 */
export function ConsoleFrame({
  label,
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { label?: ReactNode }) {
  return (
    <div data-console-frame="" {...rest} className={cn(CONSOLE_FRAME_CLASS, className)}>
      <SessionConsoleScan />
      <SessionConsoleMarks />
      {label != null && label !== false ? (
        <p data-console-frame-label="" className={`relative z-[2] px-3 pt-2 ${CONSOLE_LABEL_CLASS}`}>
          {label}
        </p>
      ) : null}
      <div className="relative z-[2] min-h-0">{children}</div>
    </div>
  );
}

/**
 * Full-page shell for auth, legal, and list screens.
 * The field stays inside the page so it does not cover a photo wash.
 */
export function ConsolePage({
  label = "01",
  children,
  className,
  ...rest
}: HTMLAttributes<HTMLDivElement> & { label?: ReactNode }) {
  return (
    <div
      data-console-frame=""
      {...rest}
      className={cn(
        "relative flex min-h-screen flex-col overflow-hidden border border-white/40 bg-black text-zinc-200",
        className,
      )}
    >
      <div
        data-console-field=""
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={CONSOLE_GRID_STYLE}
      >
        <SessionConsoleScan />
        <SessionConsoleMarks />
      </div>
      {label != null && label !== false ? (
        <p
          data-console-frame-label=""
          className={`pointer-events-none absolute bottom-3 left-3 z-[4] ${CONSOLE_LABEL_CLASS}`}
        >
          {label}
        </p>
      ) : null}
      <div className="relative z-10 flex min-h-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
