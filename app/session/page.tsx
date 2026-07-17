"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SessionView } from "@/components/SessionView";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { useI18n } from "@/lib/i18n";

function SessionContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const { t } = useI18n();

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-neutral-500 text-sm">{t('results.noSessionId')}</p>
      </div>
    );
  }

  return <SessionView sessionId={sessionId} />;
}

export default function SessionPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
          <LoadingStatusMessage message="Loading" />
        </div>
      }
    >
      <SessionContent />
    </Suspense>
  );
}
