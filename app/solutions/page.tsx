import Link from "next/link";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";
import { ProductStack } from "@/components/ProductStack";
import {
  DEFAULT_BACKGROUND,
  SOLUTION_PAGES,
  solutionMetadata,
} from "@/lib/seo/solution-pages";

const SOLUTIONS_INDEX = {
  slug: "solutions",
  path: "/solutions",
  eyebrow: "Solutions",
  h1: "Beyond benchmarks for AI. Beyond tests for humans.",
  intro:
    "openLesson verifies learning through evidence, proof of work, and cognitive analysis, then ties evidence to learning-to-conversion outcomes. These vertical guides show how teams apply Evidence API, Think Aloud Protocol, ILE, and the Agentic Learning Environment where judgment and tool use matter most.",
  metaTitle: "Solutions: Learning Verification by Vertical",
  metaDescription:
    "Learning verification guides for sales enablement, customer success, compliance, hiring assessment, engineering on-call, corporate L&D, SaaS product, and LMS integration with openLesson.",
  keywords: [
    "learning verification solutions",
    "learning-to-conversion",
    "AI training by industry",
    "workforce learning verification",
    "learning verification use cases",
  ],
  navLabel: "All Solutions",
  navDescription: "Browse vertical guides",
  sections: [],
  faqs: [],
  primaryCta: { label: "Create a workspace", href: "/workspace/new" },
  secondaryCta: { label: "Platform overview", href: "/platform" },
  closingTitle: "",
  closingBody: "",
};

export const metadata = solutionMetadata(SOLUTIONS_INDEX);

export default function SolutionsIndexPage() {
  return (
    <div
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-white"
      style={{
        backgroundImage: `linear-gradient(rgba(10,10,10,0.9), rgba(10,10,10,0.94)), url(${DEFAULT_BACKGROUND})`,
      }}
    >
      <LandingNav />

      <main className="mx-auto max-w-3xl px-6 py-12 sm:py-16">
        <header className="mb-12">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Solutions</p>
          <h1 className="mt-4 text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl lg:text-5xl">
            {SOLUTIONS_INDEX.h1}
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-neutral-400">{SOLUTIONS_INDEX.intro}</p>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            <div className="border border-cyan-400/20 bg-cyan-950/20 p-5">
              <p className="text-base leading-relaxed text-neutral-300">
                Our focus is{" "}
                <span className="font-medium text-cyan-200">learning verification</span>.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                Verify humans and agents with evidence. No exam. No benchmark theater.
              </p>
            </div>
            <div className="border border-violet-400/20 bg-violet-950/20 p-5">
              <p className="text-base leading-relaxed text-neutral-300">
                Our results are{" "}
                <span className="font-medium text-violet-200">learning-to-conversion</span>.
              </p>
              <p className="mt-3 text-sm leading-relaxed text-neutral-500">
                Evidence tied to activation, adoption, deploy gates, and production performance.
              </p>
            </div>
          </div>
        </header>

        <section className="mb-12 rounded-md border border-neutral-800 bg-neutral-950/70 p-5 sm:p-6">
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">The platform</p>
          <p className="mt-3 text-sm leading-relaxed text-neutral-400">
            Four products. One Verification Workspace. Each vertical guide below shows how teams verify
            learning, close gaps, and tie evidence to outcomes.
          </p>
          <div className="mt-6">
            <ProductStack variant="compact" />
          </div>
        </section>

        <div className="grid gap-4">
          {SOLUTION_PAGES.map((solution) => (
            <Link
              key={solution.slug}
              href={solution.path}
              className="rounded-md border border-neutral-800 bg-neutral-950/70 p-5 transition hover:border-neutral-600 hover:bg-neutral-950"
            >
              <p className="font-mono text-[10px] uppercase tracking-[1.5px] text-neutral-500">
                {solution.eyebrow}
              </p>
              <h2 className="mt-2 text-lg font-medium text-white">{solution.navLabel}</h2>
              <p className="mt-2 text-sm leading-relaxed text-neutral-500">{solution.navDescription}</p>
              <p className="mt-3 text-sm text-neutral-400 line-clamp-2">{solution.intro}</p>
            </Link>
          ))}
        </div>
      </main>

      <Footer />
    </div>
  );
}