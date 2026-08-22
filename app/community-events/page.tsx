import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { AYCL_HACKATHONS } from "@/lib/aycl-landing";
import { aestheticImageForId } from "@/lib/aesthetics";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/community-events",
});

export const metadata: Metadata = {
  title: "Community Events · Projects & Community",
  description:
    "In-person and online community events where curious people learn frontier knowledge by doing — lectures, mentors, teams, and demos.",
  alternates: {
    canonical: "https://uncertain.systems/community-events",
  },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = aestheticImageForId("hackathons", [
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
  "/aesthetics/piotr-binkowski/HGHQJOtWgAAOGtm.jpeg",
]);

export default function HackathonsPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-hackathons-page
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/80" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_20%_10%,rgba(6,182,212,0.12),transparent_35%)]" />

      <LandingNav />

      <section className="relative z-10 mx-auto w-full max-w-5xl px-4 py-10 sm:px-6 sm:py-14">
        <header className="mb-10 text-center">
          <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
            Projects & Community
          </p>
          <h1 className="text-3xl font-medium tracking-[-1.6px] text-white sm:text-5xl">
            Community Events
          </h1>
          <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-300 sm:text-lg">
            In-person and online events where curious people learn frontier
            knowledge by doing — lectures, mentors, teams, and demos on ideas
            that are still taking shape.
          </p>
        </header>

        <div className="mb-5 text-center">
          <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
            Past & upcoming events
          </p>
        </div>

        <div className="grid gap-5 sm:grid-cols-2" data-hackathons-grid>
          {AYCL_HACKATHONS.map((hackathon) => (
            <Link
              key={hackathon.id}
              href={hackathon.href}
              className="group overflow-hidden rounded-xl border border-zinc-800/90 bg-zinc-950/75 backdrop-blur-sm transition hover:border-zinc-600"
              data-hackathon-card={hackathon.id}
            >
              <div
                className="relative h-44 bg-cover bg-center sm:h-48"
                style={{ backgroundImage: `url(${hackathon.image})` }}
              >
                <div className="absolute inset-0 bg-gradient-to-t from-zinc-950/80 via-transparent to-transparent" />
                <span className="absolute left-4 top-4 border border-zinc-600/80 bg-black/60 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-300 backdrop-blur-sm">
                  {hackathon.status}
                </span>
              </div>
              <div className="space-y-4 p-5">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="border border-neutral-600/30 bg-black/55 px-2 py-1 font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-300/90">
                    {hackathon.kind}
                  </span>
                  {hackathon.host ? (
                    <span className="font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-600">
                      {hackathon.host}
                    </span>
                  ) : null}
                </div>
                <div>
                  <h2 className="text-xl font-medium leading-tight text-white group-hover:text-zinc-100">
                    {hackathon.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500">
                    {hackathon.description}
                  </p>
                </div>
                <div className="flex items-end justify-between gap-3">
                  <div className="space-y-1 text-xs text-zinc-500">
                    {hackathon.date ? <p>{hackathon.date}</p> : null}
                    {hackathon.location ? <p>{hackathon.location}</p> : null}
                  </div>
                  <span className="inline-flex items-center gap-1.5 text-sm font-medium text-white">
                    View event
                    <ArrowRight
                      size={14}
                      className="transition group-hover:translate-x-0.5"
                    />
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>

        <p className="mt-10 text-center text-sm text-zinc-600">
          Looking for lifetime learning environments?{" "}
          <Link
            href="/all-you-can-learn"
            className="text-zinc-400 underline decoration-zinc-700 underline-offset-2 hover:text-white"
          >
            Browse All-You-Can-Learn
          </Link>
        </p>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
