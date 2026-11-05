import type { Metadata } from "next";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { PublicConsoleWash, PublicPageField } from "@/components/ui/console-frame";
import { MARKETING_SHELL } from "@/lib/marketing/shell";
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

export default function KardashevPage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#0e1c2c] text-zinc-200 selection:bg-zinc-700">
      <PublicPageField image="/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg" />
      <PublicConsoleWash />
      <LandingNav />

      <section className={`${MARKETING_SHELL} flex min-h-[70vh] flex-col justify-center py-16 sm:py-20`}>
        <div className="grid items-center gap-6 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-7">
            <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Projects</p>
            <h1 className="mt-4 text-4xl font-medium tracking-[-1.6px] text-white sm:text-6xl">
              Kardashev Research
            </h1>
          </div>
          <div className="lg:col-span-5">
            <div className="console-copy p-5 sm:p-6">
              <p
                className="console-chip inline-flex px-3 py-1 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-300"
                data-kardashev-coming-soon
              >
                Coming soon
              </p>
              <p className="mt-4 text-sm leading-relaxed text-zinc-400">
                A research program in the Projects lineup. This page is a placeholder until the first public
                materials ship.
              </p>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </main>
  );
}
