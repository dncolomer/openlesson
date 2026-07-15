import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { aestheticImageForId } from "@/lib/aesthetics";
import { PRODUCT_PAGES } from "@/lib/seo/product-page";
import { HERO_PILLAR_PAGES } from "@/lib/seo/use-case-page";

const BACKGROUND_IMAGE = aestheticImageForId("use-cases-hub", [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
]);

export const metadata: Metadata = {
  title: "Use Cases | Uncertain Systems",
  description:
    "Learning verification, learning optimization, and reasoning augmentation — plus Proof-of-Work API, TAP, ILE, and ALE product pages.",
  alternates: { canonical: "https://uncertain.systems/use-cases" },
};

export default function UseCasesHubPage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0a0a] text-white selection:bg-zinc-700">
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]" />
      <div
        className="fixed inset-0 z-0 bg-cover bg-fixed bg-center"
        style={{ backgroundImage: `url(${BACKGROUND_IMAGE})` }}
        aria-hidden
      />
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/78" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.22),transparent_31%),radial-gradient(circle_at_12%_18%,rgba(39,39,42,0.62),transparent_32%)]" />

      <LandingNav />

      <main className="relative z-10 mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Use cases & products</p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
            Where Uncertain Systems fits your stack
          </h1>
          <p className="mt-5 text-lg leading-relaxed text-zinc-400">
            Start from a use case — verification, optimization, or reasoning augmentation — then pick the
            product integration depth that matches your workflow.
          </p>
        </header>

        <section className="mb-14">
          <h2 className="text-xl font-medium text-white">Use cases</h2>
          <div className="mt-6 grid gap-4">
            {HERO_PILLAR_PAGES.map((page) => (
              <Link
                key={page.path}
                href={page.path}
                className="group border border-zinc-800 bg-zinc-950/70 p-5 backdrop-blur-sm transition hover:border-zinc-600"
              >
                <p className="text-sm text-zinc-500">{page.lead}</p>
                <p className="mt-2 text-xl font-medium text-white">
                  {page.titleLines.join(" ")}
                </p>
                <ul className="mt-3 space-y-1 text-sm text-zinc-400">
                  {page.cardSummary.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
                <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 group-hover:text-white">
                  Learn more
                  <ArrowRight size={14} />
                </span>
              </Link>
            ))}
          </div>
        </section>

        <section>
          <h2 className="text-xl font-medium text-white">Products</h2>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            {PRODUCT_PAGES.map((product) => (
              <Link
                key={product.path}
                href={product.path}
                className="group border border-zinc-800 bg-zinc-950/70 p-4 backdrop-blur-sm transition hover:border-zinc-600"
              >
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">{product.eyebrow}</p>
                <p className="mt-2 text-sm font-medium text-zinc-200 group-hover:text-white">{product.h1}</p>
              </Link>
            ))}
          </div>
        </section>
      </main>

      <div className="relative z-10">
        <Footer />
      </div>
    </div>
  );
}