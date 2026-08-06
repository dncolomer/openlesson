import type { Metadata } from "next";
import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { MapOfKnowledgeClient } from "@/components/MapOfKnowledgeClient";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/map-of-knowledge",
});

export const metadata: Metadata = {
  title: "The Map of Knowledge",
  description:
    "Explore the public embedding space of Uncertain Systems — 2D and 3D knowledge configurations, regions, learner locations, and aggregated proof of work across every public workspace.",
  alternates: { canonical: "https://uncertain.systems/map-of-knowledge" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

export default function MapOfKnowledgePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />

      <LandingNav />

      {/* Compact header so the map sits near the top */}
      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-6 pb-4 sm:pt-8 sm:pb-5">
        <div className="mb-2 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          THE MAP OF KNOWLEDGE
        </div>
        <h1 className="max-w-3xl text-3xl font-medium leading-tight tracking-[-1.2px] text-white sm:text-4xl lg:text-[42px]">
          Public knowledge, as geometry.
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-zinc-400 sm:text-base">
          Explore public embeddings in 2D and 3D — then put yourself on the map with a timed
          exploratory dialog or a timed exercise (both require thinking aloud).{" "}
          <Link href="/science" className="text-zinc-300 underline-offset-2 hover:text-white hover:underline">
            The science
          </Link>
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <MapOfKnowledgeClient />
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}
