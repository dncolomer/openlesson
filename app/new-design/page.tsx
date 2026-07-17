"use client";

import React, { useState, useEffect, useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
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

export default function NewDesignLanding() {
  const [topic, setTopic] = useState("");
  const [bgImage, setBgImage] = useState("");
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const router = useRouter();

  const supabase = useMemo(
    () => createClient(),
    []
  );

  useEffect(() => {
    const random = BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)];
    setBgImage(random);
  }, []);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const handleGenerate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!topic.trim()) return;
    router.push(`/?q=${encodeURIComponent(topic.trim())}`);
  };

  return (
    <main 
      className="min-h-screen bg-[#0a0a0a] text-zinc-200 flex flex-col items-center justify-center font-sans selection:bg-zinc-700 relative overflow-hidden"
      style={bgImage ? {
        backgroundImage: `url(${bgImage})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
      } : {}}
    >
      {/* Elegant dark overlay for readability */}
      <div className="fixed inset-0 bg-[#0a0a0a]/70 z-0" />
      {/* Subtle top bar */}
      <div className="absolute top-0 w-full flex justify-center pt-6 z-10">
        <div className="text-[10px] tracking-[3px] text-zinc-600 font-mono">UNCERTAIN SYSTEMS</div>
      </div>

      <div className="absolute right-6 top-5 z-20">
        {user ? (
          <Link
            href="/dashboard"
            className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950/70 py-1.5 pl-1.5 pr-4 text-sm text-zinc-300 backdrop-blur-md transition hover:border-white/20 hover:bg-zinc-900/80 hover:text-white"
          >
            <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800 text-xs font-medium text-white">
              {user.user_metadata?.avatar_url ? (
                <img
                  src={user.user_metadata.avatar_url}
                  alt="User avatar"
                  className="h-full w-full object-cover grayscale"
                />
              ) : (
                (user.email?.[0] ?? "U").toUpperCase()
              )}
            </div>
            <span>Dashboard</span>
          </Link>
        ) : user === null ? (
          <Link
            href="/pricing"
            className="rounded-md border border-white/10 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200"
          >
            Sign up
          </Link>
        ) : null}
      </div>

      <section className="relative z-10 flex min-h-screen w-full flex-col items-center justify-center px-6 pt-20">
        {/* Hero */}
        <div className="max-w-5xl text-center pb-12">
          <div className="inline-block mb-6 px-3 py-1 text-[10px] tracking-[2px] bg-zinc-950 border border-zinc-800 text-zinc-500 rounded-sm font-mono">
            SOCRATIC • THINK ALOUD • ANY TOPIC
          </div>

          <h1 className="mx-auto max-w-4xl text-5xl sm:text-6xl lg:text-[64px] leading-[1.05] tracking-[-3.2px] font-medium text-white mb-7">
            Ready for an Eureka moment?
          </h1>

          <p className="text-lg sm:text-xl leading-relaxed text-zinc-400 tracking-[-0.35px]">
            Uncertain Systems is a think aloud tool that makes learning chill.<br />Get ready to achieve your first &quot;aha&quot; moment within 30 minutes of any lesson.
          </p>
        </div>

        {/* Primary Plan Generation Input */}
        <form onSubmit={handleGenerate} className="w-full max-w-[1360px] mb-20 relative z-10">
        <div className="group mx-auto flex w-full max-w-[940px] flex-col gap-2 rounded-md border border-zinc-800 bg-zinc-950/90 p-2 shadow-inner transition-all hover:border-zinc-700 focus-within:border-zinc-500 sm:flex-row">
          <input
            type="text"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="Paste a repo, video, theorem, or impossible question..."
            className="h-16 min-w-0 flex-1 bg-transparent px-7 text-xl outline-none placeholder:text-zinc-500 sm:h-[68px] sm:text-2xl"
            spellCheck={false}
            aria-label="Topic or goal"
          />
          <button
            type="submit"
            disabled={!topic.trim()}
            className="flex h-14 w-full shrink-0 select-none items-center justify-center rounded-sm bg-zinc-800 text-[15px] font-medium tracking-[-0.15px] text-white transition-all hover:bg-zinc-700 active:scale-[0.985] disabled:cursor-not-allowed disabled:opacity-40 sm:h-[68px] sm:w-[172px]"
          >
            Generate Workspace →
          </button>
        </div>

        {/* Smart big suggestion cards */}
        <div className="mx-auto grid grid-cols-1 md:grid-cols-3 gap-x-7 gap-y-7 mt-9 w-full max-w-[1320px] px-5 relative z-10">
          {/* Card 1: nanoGPT */}
          <button
            type="button"
            onClick={() => setTopic("Deeply understand the first principles of nanoGPT's codebase: https://github.com/karpathy/nanogpt")}
            className="group flex flex-col bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-md overflow-hidden active:scale-[0.985] transition text-left shadow"
          >
            <div className="h-48 bg-zinc-900/60 flex items-center justify-center overflow-hidden">
              <img src="https://i.ytimg.com/vi/kCc8FmEb1nY/maxresdefault.jpg" alt="nanoGPT" className="object-cover h-full w-full group-hover:scale-105 transition" />
            </div>
            <div className="p-5">
              <div className="font-medium text-[21px] leading-tight tracking-tight">Learn a Codebase</div>
              <div className="mt-1.5 text-[14px] text-zinc-400">Deeply understand the first principles of nanoGPT&apos;s codebase.</div>
              <div className="mt-4 text-[10px] tracking-[1.5px] text-emerald-400/70 font-mono">GITHUB • KARPATHY</div>
            </div>
          </button>

          {/* Card 2: Veritasium video */}
          <button
            type="button"
            onClick={() => setTopic("Turn this Veritasium video into a Socratic workspace: https://www.youtube.com/watch?v=AF8d72mA41M")}
            className="group flex flex-col bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-md overflow-hidden active:scale-[0.985] transition text-left shadow"
          >
            <div className="h-48 bg-zinc-900/60 flex items-center justify-center overflow-hidden">
              <img src="https://i.ytimg.com/vi/AF8d72mA41M/maxresdefault.jpg" alt="Veritasium Entropy" className="object-cover h-full w-full group-hover:scale-105 transition" />
            </div>
            <div className="p-5">
              <div className="font-medium text-[21px] leading-tight tracking-tight">Break Down a Scientific Video</div>
              <div className="mt-1.5 text-[14px] text-zinc-400">Don&apos;t just watch educational videos but actually extract their most important insights.</div>
              <div className="mt-4 text-[10px] tracking-widest text-emerald-400/70 font-mono">VERITASIUM • 2024</div>
            </div>
          </button>

          {/* Card 3: Classic third example */}
          <button
            type="button"
            onClick={() => setTopic(DEEP_TOPIC_SUGGESTIONS[Math.floor(Math.random() * DEEP_TOPIC_SUGGESTIONS.length)])}
            className="group flex flex-col bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-md overflow-hidden active:scale-[0.985] transition text-left shadow"
          >
            <div className="h-48 bg-zinc-900/60 flex items-center justify-center overflow-hidden">
              <img src="https://upload.wikimedia.org/wikipedia/commons/a/a5/Mus%C3%A9e_Rodin_1.jpg" alt="Der Denker statue" className="object-cover h-full w-full grayscale group-hover:scale-105 transition" />
            </div>
            <div className="p-5">
              <div className="font-medium text-[21px] leading-tight tracking-tight">Go Deep Anywhere</div>
              <div className="mt-1 text-sm text-zinc-400">Hard math, philosophy, physics.<br />No gatekeeping prerequisite maze.</div>
              <div className="mt-4 text-[10px] tracking-widest text-emerald-400/70 font-mono">AHA • EUREKA</div>
            </div>
          </button>
        </div>

        </form>

      </section>

      <div className="relative z-10 w-full">
        <Footer />
      </div>
    </main>
  );
}
