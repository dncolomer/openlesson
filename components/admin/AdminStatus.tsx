"use client";

import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { adminCardPaddedClass } from "@/components/admin/styles";

export function AdminLoading({ message = "Loading" }: { message?: string } = {}) {
  return (
    <div className="flex min-h-[40vh] items-center justify-center">
      <LoadingStatusMessage tone="muted" message={message} />
    </div>
  );
}

export function AdminError({ message }: { message: string }) {
  return (
    <div className={`${adminCardPaddedClass} flex min-h-[40vh] flex-col items-center justify-center gap-2 text-red-400`}>
      <p className="text-sm">{message}</p>
    </div>
  );
}
