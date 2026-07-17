"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { LandingNav } from "@/components/LandingNav";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { AYCL_TOKEN_STORAGE_KEY, buildAyclAccessUrl } from "@/lib/aycl-shared";

function SuccessContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get("session_id");
  const [accessUrl, setAccessUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!sessionId) {
      setError("Missing checkout session.");
      setLoading(false);
      return;
    }

    const storedToken = sessionStorage.getItem(AYCL_TOKEN_STORAGE_KEY) || "";
    let attempts = 0;

    const poll = async () => {
      attempts += 1;
      try {
        const res = await fetch(`/api/aycl/verify-session?session_id=${encodeURIComponent(sessionId)}`);
        const data = await res.json();
        if (res.ok && data.ready && storedToken) {
          const url = buildAyclAccessUrl(window.location.origin, storedToken);
          setAccessUrl(url);
          setLoading(false);
          return;
        }
        if (attempts < 20) {
          setTimeout(poll, 1500);
          return;
        }
        setError("Your purchase is processing. Refresh this page in a moment.");
        setLoading(false);
      } catch {
        setError("Could not verify your purchase.");
        setLoading(false);
      }
    };

    void poll();
  }, [sessionId]);

  const handleCopy = () => {
    if (!accessUrl) return;
    navigator.clipboard.writeText(accessUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
      {loading ? (
        <LoadingStatusMessage message="Preparing your lifetime access link" />
      ) : error ? (
        <>
          <h1 className="mb-2 text-2xl font-semibold text-white">Almost there</h1>
          <p className="mb-6 max-w-md text-sm text-neutral-500">{error}</p>
        </>
      ) : (
        <>
          <div className="mb-6 inline-flex h-16 w-16 items-center justify-center rounded-full border border-green-500/20 bg-green-500/10 text-green-400">
            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="mb-2 text-2xl font-semibold text-white">You&apos;re in for life</h1>
          <p className="mb-6 max-w-lg text-sm leading-relaxed text-neutral-500">
            Save this link — it&apos;s your private lifetime access to your forked workspace. No
            account needed. ILE included.
          </p>
          {accessUrl ? (
            <div className="mb-6 w-full max-w-xl rounded-lg border border-neutral-800 bg-neutral-950 px-4 py-3 text-left">
              <p className="break-all text-sm text-neutral-300">{accessUrl}</p>
            </div>
          ) : null}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {accessUrl ? (
              <>
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-sm text-white hover:bg-white/10"
                >
                  {copied ? "Copied!" : "Copy link"}
                </button>
                <Link
                  href={accessUrl}
                  className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-black hover:bg-neutral-200"
                >
                  Open my workspace
                </Link>
              </>
            ) : null}
          </div>
        </>
      )}
    </div>
  );
}

export default function AllYouCanLearnSuccessPage() {
  return (
    <main className="flex min-h-screen flex-col bg-[#0a0a0a] text-zinc-200">
      <LandingNav />
      <Suspense
        fallback={
          <div className="flex flex-1 items-center justify-center">
            <LoadingStatusMessage message="Loading" />
          </div>
        }
      >
        <SuccessContent />
      </Suspense>
    </main>
  );
}