import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";

export const metadata = {
  title: "Coaching - openLesson",
  description: "1-on-1 think-aloud coaching for hard problems in math, physics, and beyond.",
};

const BACKGROUND = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

export default function CoachingPage() {
  return (
    <main className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-neutral-200" style={{ backgroundImage: `url(${BACKGROUND})` }}>
      <div className="fixed inset-0 bg-black/78" />
      <div className="relative z-10 flex min-h-screen flex-col">
        <Navbar />
        <section className="mx-auto w-full max-w-6xl flex-1 px-6 py-24">
          <div className="grid gap-12 lg:grid-cols-[1fr_380px] lg:items-start">
            <div>
              <div className="mb-6 inline-block rounded-sm border border-neutral-800 bg-neutral-950/80 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">1-on-1 Coaching</div>
              <h1 className="max-w-3xl text-5xl font-medium leading-[1.05] tracking-[-2.5px] text-white sm:text-6xl">Learn how to think through hard things.</h1>
              <p className="mt-7 max-w-2xl text-lg leading-relaxed text-neutral-400">A live think-aloud session for problems where memorized steps stop working: math, physics, code, strategy, and anything that needs real reasoning.</p>
            </div>
            <div className="border border-neutral-800 bg-neutral-950/80 p-6 backdrop-blur-sm">
              <div className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">Coaching Session</div>
              <div className="mt-5 text-5xl font-medium text-white">$199</div>
              <p className="mt-3 text-sm text-neutral-500">One focused video call. Bring one hard problem or one hard idea.</p>
              <a href="https://cal.com/daniel-colomer-lvwg8w/coaching" target="_blank" rel="noopener noreferrer" className="mt-8 flex rounded-sm bg-white px-5 py-3 text-center text-sm font-medium text-black transition hover:bg-neutral-200">Book a session →</a>
            </div>
          </div>

          <div className="mt-16 grid gap-6 md:grid-cols-3">
            {["Find the stuck point", "Build the mental model", "Leave with a process"].map((title) => (
              <div key={title} className="border border-neutral-800 bg-neutral-950/75 p-6 backdrop-blur-sm">
                <h2 className="text-xl font-medium text-white">{title}</h2>
                <p className="mt-3 text-sm leading-relaxed text-neutral-400">We slow down the reasoning, make assumptions visible, and turn confusion into reusable technique.</p>
              </div>
            ))}
          </div>
        </section>
        <Footer />
      </div>
    </main>
  );
}
