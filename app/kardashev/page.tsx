import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { PublicConsoleWash } from "@/components/ui/console-frame";
import { standardShareSocialMetadata } from "@/lib/og/standard";

const standardSocial = standardShareSocialMetadata({
  url: "https://uncertain.systems/kardashev",
});

export const metadata: Metadata = {
  title: "Kardashev Research",
  description: "Kardashev Research is coming soon.",
  alternates: { canonical: "https://uncertain.systems/kardashev" },
  openGraph: standardSocial.openGraph,
  twitter: standardSocial.twitter,
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg";

export default function KardashevPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <PublicConsoleWash />
      <LandingNav />

      <section className="relative z-10 mx-auto flex min-h-[70vh] w-full max-w-3xl flex-col items-start justify-center px-6 py-20">
        <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Projects</p>
        <h1 className="mt-4 text-4xl font-medium tracking-[-1.6px] text-white sm:text-6xl">
          Kardashev Research
        </h1>
        <p
          className="console-chip mt-8 inline-flex px-3 py-1 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-300"
          data-kardashev-coming-soon
        >
          Coming soon
        </p>
      </section>

      <Footer />
    </main>
  );
}
