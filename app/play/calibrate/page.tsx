"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { PlayCalibrateSession } from "@/components/dashboard/play-calibrate-session";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

function PlayCalibrateContent() {
  const sessionId = useSearchParams().get("id") || "";
  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-black text-sm text-neutral-400">
        Missing session
      </div>
    );
  }
  return <PlayCalibrateSession sessionId={sessionId} />;
}

export default function PlayCalibratePage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-black">
          <LoadingStatusMessage message="Loading" />
        </div>
      }
    >
      <PlayCalibrateContent />
    </Suspense>
  );
}
