"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Footer } from "@/components/Footer";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { trackWorkspaceCreated } from "@/lib/analytics";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import {
  BLANK_MAP_DEFAULT_TITLE,
  resolveWorkspaceCreateOverlay,
} from "@/lib/workspace-create-modes";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

export default function NewWorkspacePage() {
  const [bgImage, setBgImage] = useState("");
  const [busy, setBusy] = useState(true);
  const [error, setError] = useState("");
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const started = useRef(false);

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void createBlankMap();
    // One-shot create on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createBlankMap() {
    setBusy(true);
    setError("");
    let succeeded = false;
    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=/workspace/new");
        return;
      }
      const response = await fetch("/api/workspace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createMode: "blank",
          title: BLANK_MAP_DEFAULT_TITLE,
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          errorMessageFromBody(payload, "Failed to create blank workspace"),
        );
      }
      const payload = await response.json();
      trackWorkspaceCreated({ hasFiles: false });
      router.push(`/workspace/${payload.workspaceId}`);
      succeeded = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(resolveWorkspaceCreateOverlay({ succeeded }).busy);
    }
  }

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-create-blank-map
      style={
        bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}
      }
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/76" />
      <PublicConsoleWash />
      <div
        className={`fixed inset-0 z-30 flex items-center justify-center transition-opacity duration-700 ${busy ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <LoadingStatusMessage message="Creating workspace" />
      </div>

      <header
        className={`relative z-10 flex w-full items-center justify-between px-6 py-5 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-white transition hover:text-zinc-300"
        >
          Uncertain Systems
        </Link>
        {/* Login removed from workspace new screen by design */}
      </header>

      <section
        className={`relative z-10 flex flex-1 items-center justify-center px-6 py-12 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        {error ? (
          <div className="mx-auto max-w-lg rounded-none border border-zinc-800 bg-zinc-950/90 p-6 text-center">
            <p className="text-sm text-red-300">{error}</p>
            <button
              type="button"
              onClick={() => {
                void createBlankMap();
              }}
              className="mt-5 rounded-none bg-white px-4 py-2 text-sm font-medium text-black"
              data-create-blank-retry
            >
              Try again
            </button>
          </div>
        ) : null}
      </section>

      <div
        className={`relative z-10 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <Footer />
      </div>
    </main>
  );
}
