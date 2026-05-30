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
          <button type="button" onClick={() => router.push("/rabbit-hole")} className="group relative z-10 mx-auto mt-9 flex w-[calc(100%-2rem)] max-w-[940px] cursor-pointer flex-col overflow-hidden rounded-md border border-zinc-800 bg-zinc-950 text-left shadow transition hover:border-zinc-700 active:scale-[0.985] md:flex-row"><div className="flex h-56 items-center justify-center overflow-hidden bg-zinc-900/60 md:h-auto md:w-[42%]"><img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Mus%C3%A9e_Rodin_1.jpg" alt="Der Denker statue" className="h-full w-full object-cover grayscale transition group-hover:scale-105" /></div><div className="flex flex-1 flex-col justify-center p-6 md:p-8"><div className="font-mono text-[10px] tracking-widest text-emerald-400/70">RABBIT HOLE</div><div className="mt-3 text-[28px] font-medium leading-tight tracking-tight text-white">Follow one question deeper.</div><div className="mt-3 max-w-lg text-sm leading-relaxed text-zinc-400">Pick a question, choose the branch that pulls at you, and keep going until the idea finally clicks.</div><div className="mt-6 inline-flex h-11 w-fit items-center justify-center rounded-sm bg-white px-5 text-sm font-medium text-black transition group-hover:bg-zinc-200">Try Rabbit Hole →</div></div></button>
        </form>
      </section>

      <div className={`relative z-10 w-full transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}><Footer /></div>
    </main>
  );
}
