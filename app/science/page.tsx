import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Footer } from "@/components/Footer";
import { LandingNav } from "@/components/LandingNav";

export const metadata: Metadata = {
  title: "Science",
  description:
    "A holistic model of knowledge: brain configuration, proximity, transformation, and a non-invasive path to self-driving learning.",
  alternates: { canonical: "https://uncertain.systems/science" },
  openGraph: {
    title: "Science | Uncertain Systems",
    description:
      "A holistic model of knowledge: brain configuration, proximity, transformation, and self-driving learning.",
    url: "https://uncertain.systems/science",
    images: [{ url: "/science/opengraph-image", width: 1200, height: 630, alt: "Science" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Science | Uncertain Systems",
    images: ["/science/opengraph-image"],
  },
};

const BACKGROUND_IMAGE = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

const PRINCIPLES = [
  {
    number: "01",
    title: "Brain Configuration",
    subtitle: "The full physical state of a human brain at a specific point in time.",
    body: "Every moment of thought, memory, and skill lives in a unique configuration of neural activity. Understanding learning means understanding how one configuration relates to another — not just what was answered on a test.",
  },
  {
    number: "02",
    title: "Knowledge = Proximity",
    subtitle: "A useful configuration is close enough to retrieve, apply, and transform.",
    body: "Knowledge is not a binary flag. It is how near your current brain state is to a configuration where you can reliably retrieve, apply, and transform what you need. Closeness — not completion percentage — is the meaningful signal.",
  },
  {
    number: "03",
    title: "Learning = Transformation",
    subtitle: "Learning is movement through configuration space, ideally with less wasted effort.",
    body: "To learn is to move from one configuration toward another useful one. The goal of educational technology should be to shorten that path — reducing wasted effort while preserving depth of understanding.",
  },
  {
    number: "04",
    title: "Non-Invasive Path",
    subtitle: "Start with software attention loops, then add world models, stimulation, and biofeedback.",
    body: "We begin with software: attention loops, Socratic questioning, and proof-of-work verification. Over time we layer world models, non-invasive stimulation, and biofeedback — building toward self-driving learning without asking humans to burn proportionally more energy.",
  },
];

export default function SciencePage() {
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

      <section className="relative z-10 mx-auto w-full max-w-6xl px-6 pt-14 pb-10 sm:pt-16 sm:pb-12">
        <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
          SCIENCE
        </div>
        <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[68px]">
          A holistic model of knowledge.
        </h1>
        <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">
          Uncertain Systems is grounded in a physical view of learning: brains as configuration spaces, knowledge
          as proximity, and education technology as a path toward transformation with less wasted effort.
        </p>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 py-10 sm:py-12">
        <div className="space-y-6">
          {PRINCIPLES.map((principle) => (
            <article
              key={principle.number}
              className="border border-zinc-800 bg-zinc-950/70 p-6 backdrop-blur-sm sm:p-8"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:gap-8">
                <p className="shrink-0 font-mono text-3xl font-medium tracking-tight text-zinc-600 sm:w-16">
                  {principle.number}
                </p>
                <div>
                  <h2 className="text-2xl font-medium tracking-[-0.8px] text-white sm:text-3xl">{principle.title}</h2>
                  <p className="mt-2 text-base font-medium text-zinc-300">{principle.subtitle}</p>
                  <p className="mt-4 text-base leading-relaxed text-zinc-400">{principle.body}</p>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>

      <section className="relative z-10 mx-auto max-w-6xl px-6 pb-16">
        <div className="border border-zinc-800 bg-zinc-950/70 p-6 sm:p-8">
          <p className="text-base leading-relaxed text-zinc-400">
            This model drives everything we build — from learning verification and think-aloud protocol today,
            to predictive interruption models and non-invasive hardware tomorrow.
          </p>
          <Link
            href="/vision"
            className="mt-6 inline-flex items-center gap-1.5 text-sm font-medium text-zinc-300 transition hover:text-white"
          >
            See our vision
            <ArrowRight size={14} />
          </Link>
        </div>
      </section>

      <div className="relative z-10">
        <Footer />
      </div>
    </main>
  );
}