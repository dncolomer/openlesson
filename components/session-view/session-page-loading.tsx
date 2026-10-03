"use client";

import type { HTMLAttributes, ReactNode } from "react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { cn } from "@/lib/utils";

/**
 * Full-page centered wait shared by Learn, Prepare, Drill, conversational TAP,
 * and Verify. Learn's start tips render as children. Saving waits pass message.
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
      {...rest}
      className={cn(
        "flex h-full min-h-0 w-full flex-1 flex-col items-center justify-center bg-[#0a0a0a] px-6",
        className,
      )}
    >
      {message ? <LoadingStatusMessage message={message} className="text-center" /> : null}
      {children}
    </div>
  );
}
