"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { User } from "@supabase/supabase-js";
import { Footer } from "@/components/Footer";

interface SolutionLandingProps {
  eyebrow: string;
  title: string;
  intro: string;
  backgroundImage: string;
  challenges: string[];
  solutions: string[];
}

export function SolutionLanding({
  eyebrow,
  title,
  intro,
  backgroundImage,
  challenges,
  solutions,
}: SolutionLandingProps) {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const supabase = useMemo(
    () => createClient(),
    []
  );

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => setUser(session?.user ?? null));
    return () => subscription.unsubscribe();
  }, [supabase]);

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-zinc-200"
      style={{ backgroundImage: `url(${backgroundImage})` }}
    >
      <div className="fixed inset-0 bg-[#0a0a0a]/75" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <div className="absolute right-6 top-5 z-20">
          {user ? (
            <Link href="/dashboard" className="flex items-center gap-2 rounded-md border border-white/10 bg-zinc-950/70 py-1.5 pl-1.5 pr-4 text-sm text-zinc-300 backdrop-blur-md transition hover:border-white/20 hover:bg-zinc-900/80 hover:text-white">
              <div className="flex size-9 items-center justify-center overflow-hidden rounded-full border border-white/10 bg-zinc-800 text-xs font-medium text-white">
                {user.user_metadata?.avatar_url ? <img src={user.user_metadata.avatar_url} alt="User avatar" className="h-full w-full object-cover grayscale" /> : (user.email?.[0] ?? "U").toUpperCase()}
              </div>
              <span>Dashboard</span>
            </Link>
          ) : user === null ? (
            <Link href="/pricing" className="rounded-md border border-white/10 bg-white px-5 py-2.5 text-sm font-medium text-black transition hover:bg-zinc-200">Get started</Link>
          ) : null}
        </div>

        <section className="mx-auto flex w-full max-w-6xl flex-1 flex-col justify-center px-6 py-24">
          <div className="max-w-4xl">
            <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
              {eyebrow}
            </div>
            <h1 className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-2.5px] text-white sm:text-6xl">
              {title}
            </h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-zinc-400">
              {intro}
            </p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-2">
            <section className="border border-zinc-800/70 bg-zinc-950/75 p-6 backdrop-blur-sm">
              <h2 className="mb-5 font-mono text-xs uppercase tracking-[2px] text-zinc-500">
                Revisited Challenges
              </h2>
              <ul className="space-y-4 text-lg leading-relaxed text-zinc-300">
                {challenges.map((item) => (
                  <li key={item} className="border-t border-zinc-800/80 pt-4">
                    {item}
                  </li>
                ))}
              </ul>
            </section>

            <section className="border border-zinc-800/70 bg-zinc-950/75 p-6 backdrop-blur-sm">
              <h2 className="mb-5 font-mono text-xs uppercase tracking-[2px] text-zinc-500">
                How Uncertain Systems Solves It
              </h2>
              <ul className="space-y-4 text-lg leading-relaxed text-zinc-300">
                {solutions.map((item) => (
                  <li key={item} className="border-t border-zinc-800/80 pt-4">
                    {item}
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </section>

        <Footer />
      </div>
    </main>
  );
}
