"use client";

import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

export function AdminLoading({ message = "Loading" }: { message?: string } = {}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingStatusMessage tone="muted" message={message} />
    </div>
  );
}

export function AdminError({ message }: { message: string }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-2 text-red-400">
      <p>{message}</p>
    </div>
  );
}