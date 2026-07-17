"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";
import { Footer } from "@/components/Footer";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { trackWorkspaceCreated } from "@/lib/analytics";
import {
  DEFAULT_INITIAL_CHAPTERS,
  INITIAL_CHAPTERS_BANDS,
  INITIAL_CHAPTERS_LEVELS,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

const LEVEL_COPY: Record<
  InitialChaptersLevel,
  { title: string; description: string }
> = {
  narrow: {
    title: "Narrow",
    description: "Fewer blocks — calmer start",
  },
  mid: {
    title: "Balanced",
    description: "Standard block count",
  },
  broad: {
    title: "Broad",
    description: "More blocks and deeper branches",
  },
};

export default function NewWorkspacePage() {
  const [topic, setTopic] = useState("");
  const [bgImage, setBgImage] = useState("");
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [initialChapters, setInitialChapters] = useState<InitialChaptersLevel>(
    DEFAULT_INITIAL_CHAPTERS,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError("");

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
          topic: topic.trim(),
          days: 28,
          initialChapters,
          ...(files.length > 0 ? { files: files.map(({ name, mimeType, data }) => ({ name, mimeType, data })) } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to generate workspace");
      }

      const payload = await response.json();
      trackWorkspaceCreated({ hasFiles: files.length > 0 });
      router.push(`/workspace/${payload.workspaceId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/76" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.16),transparent_32%)]" />
      <div className={`fixed inset-0 z-30 flex items-center justify-center transition-opacity duration-700 ${busy ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-live="polite" aria-atomic="true">
        <LoadingStatusMessage message="Creating workspace" />
      </div>

      <header className={`relative z-10 flex w-full items-center justify-between px-6 py-5 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <Link href="/" className="text-base font-semibold tracking-tight text-white transition hover:text-zinc-300">Uncertain Systems</Link>
        <Link href="/login" className="rounded-sm border border-zinc-800 bg-zinc-950/70 px-4 py-2 text-sm text-zinc-400 backdrop-blur-md transition hover:border-zinc-700 hover:text-white">Login</Link>
      </header>

      <section className={`relative z-10 flex flex-1 items-center justify-center px-6 py-20 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="w-full max-w-[940px]">
          <div className="mb-7 text-center">
            <div className="mb-5 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">STEP 1 • DEFINE THE WORKSPACE</div>
            <h1 className="text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">Create your Workspace.</h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">Describe the skill, decision, scenario, or source material your team needs to practice against. Add files if they provide useful context.</p>
          </div>

          <form onSubmit={handleGenerate}>
            <div className="group mx-auto flex w-full flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/90 p-2 shadow-inner transition-all hover:border-zinc-700 focus-within:border-zinc-500 sm:flex-row">
              <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Describe the performance scenario or skill to verify..." className="h-16 min-w-0 flex-1 bg-transparent px-7 text-xl outline-none placeholder:text-zinc-500 sm:h-[68px] sm:text-2xl" spellCheck={false} />
              <button type="submit" disabled={!topic.trim() || busy} className="flex h-14 w-full shrink-0 items-center justify-center rounded-sm bg-white text-[15px] font-medium text-black transition-all hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40 sm:h-[68px] sm:w-[210px]">{busy ? "Creating..." : "Create Workspace →"}</button>
            </div>

            <div className="mx-auto mt-4 w-full">
              <div className="mb-2 flex items-end justify-between gap-3">
                <label className="block font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                  Initial chapters
                </label>
                <span className="text-[11px] text-zinc-600">
                  About {INITIAL_CHAPTERS_BANDS[initialChapters].target} blocks
                  {" "}({INITIAL_CHAPTERS_BANDS[initialChapters].min}–{INITIAL_CHAPTERS_BANDS[initialChapters].max})
                </span>
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                {INITIAL_CHAPTERS_LEVELS.map((level) => {
                  const selected = initialChapters === level;
                  const copy = LEVEL_COPY[level];
                  return (
                    <button
                      key={level}
                      type="button"
                      onClick={() => setInitialChapters(level)}
                      disabled={busy}
                      className={`rounded-md border px-3 py-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
                        selected
                          ? "border-zinc-300 bg-zinc-900 ring-1 ring-zinc-300/30"
                          : "border-zinc-800 bg-zinc-950/80 hover:border-zinc-600"
                      }`}
                    >
                      <span className="block text-sm font-medium text-zinc-100">{copy.title}</span>
                      <span className="mt-1 block text-[11px] leading-snug text-zinc-500">
                        {copy.description}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="mx-auto mt-3 w-full">
              <FileDropZone files={files} onChange={setFiles} compact className="rounded-md bg-zinc-950/70 p-2" />
              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
            </div>
          </form>
        </div>
      </section>

      <div className={`relative z-10 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <Footer />
      </div>
    </main>
  );
}
