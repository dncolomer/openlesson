"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { SessionView } from "@/components/SessionView";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { useI18n } from "@/lib/i18n";
import { isIleResumeQuery } from "@/lib/block-previous-sessions";

function SessionContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("id");
  const resumeSession = isIleResumeQuery(searchParams.get("resume"));
  const { t } = useI18n();

  if (!sessionId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-neutral-500 text-sm">{t('results.noSessionId')}</p>
      </div>
    );
  }

  return <SessionView sessionId={sessionId} resumeSession={resumeSession} />;
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
