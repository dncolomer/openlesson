"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";
import type { User } from "@supabase/supabase-js";
import { FileDropZone, type AttachedFile } from "@/components/FileDropZone";
import { Footer } from "@/components/Footer";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

const DEEP_TOPIC_SUGGESTIONS = [
  "Why does entropy always increase?",
  "What did Socrates actually mean by knowing nothing?",
  "How did the Roman Republic collapse?",
  "Why is quantum measurement so weird?",
  "What makes a mathematical proof feel inevitable?",
  "How did the printing press change human consciousness?",
  "What is consciousness, really?",
  "Why did general relativity change our idea of space and time?",
  "How did Darwin discover natural selection?",
  "What does Nietzsche mean by eternal recurrence?",
];

export default function Home() {
  const [topic, setTopic] = useState("");
  const [bgImage, setBgImage] = useState("");
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [files, setFiles] = useState<AttachedFile[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  const supabase = useMemo(
    () => createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    ),
    []
  );

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get("q")?.trim();
    if (q) setTopic(q);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

  async function handleGenerate(e: React.FormEvent) {
    e.preventDefault();
    if (!topic.trim() || busy) return;
    setBusy(true);
    setError("");

    try {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login?redirect=plan");
        return;
      }

      const response = await fetch("/api/learning-plan/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: topic.trim(),
          days: 28,
          ...(files.length > 0 ? { files: files.map(({ name, mimeType, data }) => ({ name, mimeType, data })) } : {}),
        }),
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || "Failed to generate plan");
      }

      const payload = await response.json();
      router.push(`/plan/${payload.planId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main
      className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0a0a0a] font-sans text-zinc-200 selection:bg-zinc-700"
      style={bgImage ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" } : {}}
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/70" />
      <div className={`fixed inset-0 z-30 flex items-center justify-center transition-opacity duration-700 ${busy ? "opacity-100" : "pointer-events-none opacity-0"}`} aria-live="polite" aria-atomic="true">
        <div className="font-mono text-sm uppercase tracking-[4px] text-white/90 sm:text-base">
          <span className="animate-pulse">Generating</span>
          <span className="ml-2 inline-flex w-8 justify-between align-middle" aria-hidden="true">
            <span className="animate-bounce">.</span>
            <span className="animate-bounce" style={{ animationDelay: "120ms" }}>.</span>
            <span className="animate-bounce" style={{ animationDelay: "240ms" }}>.</span>
          </span>
        </div>
      </div>

      <div className={`absolute top-0 z-10 flex w-full justify-center pt-6 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="font-mono text-[10px] tracking-[3px] text-zinc-600">OPENLESSON</div>
      </div>

      <div className={`absolute right-6 top-5 z-20 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        {user ? (
          <Link href="/dashboard" className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950/70 py-1.5 pl-1.5 pr-4 text-sm text-zinc-300 backdrop-blur-md transition hover:border-white/20 hover:bg-zinc-900/80 hover:text-white">
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800 text-xs font-medium text-white">
              {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="User avatar" className="h-full w-full object-cover grayscale" /> : (user.email?.[0] ?? "U").toUpperCase()}
            </div>
            <span>Dashboard</span>
          </Link>
        ) : user === null ? (
          <Link href="/register" className="rounded-md border border-white/10 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200">Sign up</Link>
        ) : null}
      </div>

      <section className={`relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-6 pt-20 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}>
        <div className="max-w-5xl pb-12 text-center">
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">SOCRATIC • THINK ALOUD • ANY TOPIC</div>
          <h1 className="mx-auto mb-7 max-w-4xl text-5xl font-medium leading-[1.05] tracking-[-3.2px] text-white sm:text-6xl lg:text-[64px]">Ready for an Eureka moment?</h1>
          <p className="text-lg leading-relaxed tracking-[-0.35px] text-zinc-400 sm:text-xl">Open Lesson is a think aloud tool that makes learning chill.<br />Get ready to achieve your first &quot;aha&quot; moment within 30 minutes of any lesson.</p>
        </div>

        <form onSubmit={handleGenerate} className="relative z-10 mb-20 w-full max-w-[1360px]">
          <div className="group mx-auto flex w-full max-w-[940px] flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/90 p-2 shadow-inner transition-all hover:border-zinc-700 focus-within:border-zinc-500 sm:flex-row">
            <input value={topic} onChange={(e) => setTopic(e.target.value)} placeholder="Paste a repo, video, theorem, or impossible question..." className="h-16 min-w-0 flex-1 bg-transparent px-7 text-xl outline-none placeholder:text-zinc-500 sm:h-[68px] sm:text-2xl" spellCheck={false} />
            <button type="submit" disabled={!topic.trim() || busy} className="flex h-14 w-full shrink-0 items-center justify-center rounded-sm bg-zinc-800 text-[15px] font-medium text-white transition-all hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-40 sm:h-[68px] sm:w-[172px]">{busy ? "Generating..." : "Generate Plan →"}</button>
          </div>
          <div className="mx-auto mt-3 w-full max-w-[940px]">
            <FileDropZone files={files} onChange={setFiles} compact className="rounded-md bg-zinc-950/70 p-2" />
            {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
          </div>

          <div className="relative z-10 mx-auto mt-9 grid w-full max-w-[1320px] grid-cols-1 gap-x-7 gap-y-7 px-5 md:grid-cols-3">
            <button type="button" onClick={() => setTopic("Deeply understand the first principles of nanoGPT's codebase: https://github.com/karpathy/nanogpt")} className="group flex flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left shadow transition hover:border-zinc-700 active:scale-[0.985]"><div className="flex h-48 items-center justify-center overflow-hidden bg-zinc-900/60"><img src="https://i.ytimg.com/vi/kCc8FmEb1nY/maxresdefault.jpg" alt="nanoGPT" className="h-full w-full object-cover grayscale transition group-hover:scale-105" /></div><div className="p-5"><div className="text-[21px] font-medium leading-tight tracking-tight">Learn a Codebase</div><div className="mt-1.5 text-[14px] text-zinc-400">Deeply understand the first principles of nanoGPT&apos;s codebase.</div><div className="mt-4 font-mono text-[10px] tracking-[1.5px] text-emerald-400/70">GITHUB • KARPATHY</div></div></button>
            <button type="button" onClick={() => setTopic("Turn this Veritasium video into a Socratic learning plan: https://www.youtube.com/watch?v=AF8d72mA41M")} className="group flex flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left shadow transition hover:border-zinc-700 active:scale-[0.985]"><div className="flex h-48 items-center justify-center overflow-hidden bg-zinc-900/60"><img src="https://i.ytimg.com/vi/AF8d72mA41M/maxresdefault.jpg" alt="Veritasium Entropy" className="h-full w-full object-cover grayscale transition group-hover:scale-105" /></div><div className="p-5"><div className="text-[21px] font-medium leading-tight tracking-tight">Break Down a Scientific Video</div><div className="mt-1.5 text-[14px] text-zinc-400">Don&apos;t just watch educational videos but actually extract their most important insights.</div><div className="mt-4 font-mono text-[10px] tracking-widest text-emerald-400/70">VERITASIUM • 2024</div></div></button>
            <button type="button" onClick={() => setTopic(DEEP_TOPIC_SUGGESTIONS[Math.floor(Math.random() * DEEP_TOPIC_SUGGESTIONS.length)])} className="group flex flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left shadow transition hover:border-zinc-700 active:scale-[0.985]"><div className="flex h-48 items-center justify-center overflow-hidden bg-zinc-900/60"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Mus%C3%A9e_Rodin_1.jpg" alt="Der Denker statue" className="h-full w-full object-cover grayscale transition group-hover:scale-105" /></div><div className="p-5"><div className="text-[21px] font-medium leading-tight tracking-tight">Go Deep Anywhere</div><div className="mt-1 text-sm text-zinc-400">Hard math, philosophy, physics.<br />No gatekeeping prerequisite maze.</div><div className="mt-4 font-mono text-[10px] tracking-widest text-emerald-400/70">AHA • EUREKA</div></div></button>
          </div>
        </form>
      </section>

      <div className={`relative z-10 w-full transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}><Footer /></div>
    </main>
  );
}
