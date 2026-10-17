"use client";

import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const SESSION_START_BACK_BUTTON_CLASS =
  "mb-2 inline-flex w-full items-center justify-center gap-2 rounded-none border border-neutral-800 bg-black px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-neutral-200 transition-colors hover:border-neutral-600 hover:bg-neutral-950 hover:text-white";

export function SessionStartBackButton({
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      {...rest}
      data-session-back-to-workspace=""
      className={cn(SESSION_START_BACK_BUTTON_CLASS, className)}
    >
      {children}
    </button>
  );
}
