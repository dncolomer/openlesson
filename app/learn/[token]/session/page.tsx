"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import { SessionView } from "@/components/SessionView";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

function AyclSessionContent() {
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const accessToken = params.token as string;

  if (!sessionId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
        <p className="text-sm text-neutral-500">No session selected.</p>
      </div>
    );
  }

  return <SessionView sessionId={sessionId} ayclToken={accessToken} />;
}

export default function AyclSessionPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0a0a]">
          <LoadingStatusMessage message="Loading" />
        </div>
      }
    >
      <AyclSessionContent />
    </Suspense>
  );
}