import Link from "next/link";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg";

export default function AboutPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-neutral-200" style={{ backgroundImage: `url(${BACKGROUND})` }}>
      <div className="fixed inset-0 bg-black/78" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-24">
          <div className="max-w-4xl">
            <div className="mb-6 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">About Open Lesson</div>
            <h1 className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-2.5px] text-white sm:text-6xl">Learning should feel like realizing, not grinding.</h1>
            <p className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-400">Open Lesson is a think-aloud learning environment built around Socratic dialogue. It helps you get unstuck, connect ideas, and experience real aha moments without a rigid prerequisite maze.</p>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {["Think aloud first", "Socratic by default", "Any topic is fair game"].map((title, index) => (
              <div key={title} className="border border-neutral-800 bg-neutral-950/75 p-6 backdrop-blur-sm">
                <div className="mb-5 font-mono text-[10px] uppercase tracking-[2px] text-neutral-600">0{index + 1}</div>
                <h2 className="text-xl font-medium text-white">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">
                  {index === 0 && "The fastest way to reveal confusion is to explain what you think is happening."}
                  {index === 1 && "Open Lesson asks better questions before it gives you better answers."}
                  {index === 2 && "Codebases, videos, papers, math, history, philosophy: bring the thing itself."}
                </p>
              </div>
            ))}
          </div>

          <div className="mt-16 border border-neutral-800 bg-neutral-950/75 p-8 backdrop-blur-sm">
            <h2 className="text-2xl font-medium text-white">Built for the first 30 minutes.</h2>
            <p className="mt-4 max-w-3xl leading-relaxed text-neutral-400">Most tools optimize for curriculum completion. Open Lesson optimizes for the first moment where something clicks, then turns that momentum into a plan you can keep following.</p>
            <Link href="/" className="mt-8 inline-flex rounded-sm bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-neutral-200">Start a workspace →</Link>
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}
