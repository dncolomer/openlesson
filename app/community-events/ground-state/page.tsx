import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { AYCL_HACKATHONS } from "@/lib/aycl-landing";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const EVENT = AYCL_HACKATHONS.find((event) => event.id === "ground-state");

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/community-events/ground-state",
});

export const metadata: Metadata = {
  title: "Thermosynthesis · Community Events",
  description: "To be Announced soon",
  alternates: {
    canonical: "https://uncertain.systems/community-events/ground-state",
  },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

export default function GroundStateEventPage() {
  return (
    <main
      className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      data-ground-state-page
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{
          backgroundImage: `url(${EVENT?.image ?? "/hackathons/ground-state-hero.jpg"})`,
        }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/82" />

      <LandingNav />

      <section className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-center justify-center px-4 py-16 text-center sm:px-6">
        <nav aria-label="Breadcrumb" className="mb-10 text-xs text-zinc-500">
          <ol className="flex flex-wrap items-center justify-center gap-2">
            <li>
              <Link href="/" className="transition hover:text-white">
                Home
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li>
              <Link
                href="/community-events"
                className="transition hover:text-white"
              >
                Community Events
              </Link>
            </li>
            <li className="text-zinc-700">/</li>
            <li className="text-zinc-400">Thermosynthesis</li>
          </ol>
        </nav>

        <p className="mb-4 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          {EVENT?.kind ?? "3 Day Event"}
        </p>
        <h1 className="text-3xl font-medium tracking-[-1.6px] text-white sm:text-5xl">
          {EVENT?.title ?? "Thermosynthesis"}
        </h1>
        <p className="mt-6 text-lg leading-relaxed text-zinc-300 sm:text-xl">
          To be Announced soon
        </p>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
