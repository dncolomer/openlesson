import {
  PitchWebHeadline,
  PitchWebKicker,
  PitchWebPoints,
} from "@/components/pitch-web/pitch-web-chrome";
import {
  PitchWebDepthChart,
  PitchWebEngineFlow,
  PitchWebGpsVsAutopilot,
  PitchWebGtmTimeline,
  PitchWebHiddenStateMap,
  PitchWebRegionMap,
} from "@/components/pitch-web/pitch-web-figures";

function Source({ children }: { children: React.ReactNode }) {
  return (
    <span className="ml-1.5 font-mono text-[12px] uppercase tracking-[1.4px] text-[#6ec8e8]">
      {children}
    </span>
  );
}

export function PitchWebProblemSlide() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[0.92fr_1.18fr] items-stretch gap-6" data-pitch-web-slide="problem">
      <section className="flex h-full min-h-0 flex-col border border-white/70 bg-black/70 px-8 py-7">
        <PitchWebKicker>01 // THE PROBLEM</PitchWebKicker>
        <PitchWebHeadline
          lines={[
            { text: "Frontier fields" },
            { text: "outrun their", tone: "cyan" },
            { text: "teachers" },
          ]}
        />
        <PitchWebPoints
          items={[
            {
              n: "01",
              text: "Frontier fields outpace their teachers, e.g. math, quantum and thermodynamic computing.",
            },
            {
              n: "02",
              text: "Globally: frontier tech moves at different speeds; the US-Europe gap is visible.",
            },
            {
              n: "03",
              text: (
                <>
                  At companies: quantum postings +58% in 8 months of 2026 vs all of 2025
                  <Source>Business Insider</Source>
                  <br />
                  Agentic AI mentions: +280% YoY
                  <Source>Lightcast</Source>
                </>
              ),
            },
          ]}
        />
      </section>
      <PitchWebDepthChart />
    </div>
  );
}

export function PitchWebAutopilotSlide() {
  return (
    <div className="flex h-full flex-col gap-5" data-pitch-web-slide="autopilot">
      <div className="grid grid-cols-[0.78fr_1.22fr] gap-8">
        <div>
          <PitchWebKicker>02 // AUTOPILOT</PitchWebKicker>
          <PitchWebHeadline lines={[{ text: "Autopilot", tone: "cyan" }]} />
        </div>
        <PitchWebPoints
          compact
          items={[
            {
              n: "01",
              text: "AI tutors are the GPS of learning: tailored routes and guidance throughout the journey.",
            },
            { n: "02", text: "We are building the autopilot." },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        <PitchWebGpsVsAutopilot />
      </div>
    </div>
  );
}

export function PitchWebFreeEnergySlide() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[0.86fr_1.14fr] items-stretch gap-6" data-pitch-web-slide="free-energy">
      <section className="flex h-full min-h-0 flex-col border border-white/70 bg-black/70 px-8 py-7">
        <PitchWebKicker>03 // UNDER THE HOOD</PitchWebKicker>
        <PitchWebHeadline
          lines={[
            { text: "Free energy" },
            { text: "principle", tone: "cyan" },
          ]}
        />
        <PitchWebPoints
          items={[
            {
              n: "01",
              text: "We simulate the topic as a map of hidden states, and how someone would explore it (active inference, epistemic foraging).",
            },
            {
              n: "02",
              text: "Your proof of work is mapped onto it as you go: what you say, write and draw.",
            },
            {
              n: "03",
              text: "No content feed, no Q&A drill. It shows the next step that most reduces your uncertainty.",
            },
          ]}
        />
      </section>
      <PitchWebHiddenStateMap />
    </div>
  );
}

export function PitchWebEngineSlide() {
  return (
    <div className="flex h-full flex-col gap-5" data-pitch-web-slide="engine">
      <div className="grid grid-cols-[0.78fr_1.22fr] gap-8">
        <div>
          <PitchWebKicker>04 // KNOWLEDGE EMBEDDINGS</PitchWebKicker>
          <PitchWebHeadline
            lines={[
              { text: "The" },
              { text: "engine", tone: "cyan" },
            ]}
          />
        </div>
        <PitchWebPoints
          compact
          items={[
            { n: "01", text: "We take the experts in the fields." },
            { n: "02", text: "We embed their knowledge in a knowledge embedding space." },
            { n: "03", text: "We build software + hardware on it: learning on autopilot." },
            {
              n: "04",
              text: "The same engine validates hard knowledge and hard skills, solving the local problem inside a company.",
            },
          ]}
        />
      </div>
      <div className="min-h-0 flex-1">
        <PitchWebEngineFlow />
      </div>
    </div>
  );
}

export function PitchWebArtifactSlide() {
  return (
    <div className="grid h-full min-h-0 grid-cols-[0.86fr_1.14fr] items-stretch gap-6" data-pitch-web-slide="artifact">
      <section className="flex h-full min-h-0 flex-col border border-white/70 bg-black/70 px-8 py-7">
        <PitchWebKicker>05 // THE ARTIFACT</PitchWebKicker>
        <PitchWebHeadline
          lines={[
            { text: "Knowledge" },
            { text: "regions", tone: "cyan" },
          ]}
        />
        <PitchWebPoints
          items={[
            {
              n: "01",
              text: "This is a real artifact: a knowledge region built from your experts.",
            },
            {
              n: "02",
              text: "Your company builds it and owns it, with Uncertain Systems. Privacy-native: no sensitive data leaves.",
            },
            {
              n: "03",
              text: "It becomes your living representation of the skills you need.",
            },
            {
              n: "04",
              text: "Measure any person or content by distance to the region.",
            },
          ]}
        />
      </section>
      <PitchWebRegionMap />
    </div>
  );
}

export function PitchWebGtmSlide() {
  return (
    <div className="flex h-full flex-col gap-5" data-pitch-web-slide="gtm">
      <div className="grid grid-cols-[1fr_1fr] items-stretch gap-8">
        <div className="flex h-full flex-col">
          <PitchWebKicker>06 // GO-TO-MARKET</PitchWebKicker>
          <PitchWebHeadline
            lines={[
              { text: "Start with" },
              { text: "software and data", tone: "cyan" },
            ]}
          />
        </div>
        <aside className="h-full border border-white/55 bg-[#071820] px-6 py-5">
          <p className="font-mono text-[13px] uppercase tracking-[1.8px] text-[#6ec8e8]">
            Why communities // designed for expert data
          </p>
          <p className="mt-3 font-mono text-[16px] uppercase tracking-[1.2px] text-[#6ec8e8]">
            This GTM is built to reach expert data.
          </p>
          <p className="mt-3 text-[17px] leading-snug text-zinc-300">
            Frontier experts are scarce and already have a job. They won&apos;t take
            low-prestige, low-paid AI tutor or data-collection gigs.
          </p>
          <p className="mt-3 text-[17px] leading-snug text-zinc-300">
            So we reach them through communities they already belong to and care about.
          </p>
        </aside>
      </div>
      <div className="min-h-0 flex-1">
        <PitchWebGtmTimeline />
      </div>
    </div>
  );
}

function StatCard({
  value,
  label,
  body,
  accent,
}: {
  value: string;
  label: string;
  body: string;
  accent?: boolean;
}) {
  return (
    <div
      className={
        accent
          ? "flex h-full min-h-0 flex-col border border-white/55 bg-[#071820] px-6 py-6"
          : "flex h-full min-h-0 flex-col border border-white/70 bg-black/75 px-6 py-6"
      }
    >
      <p
        className={
          accent
            ? "font-mono text-[56px] font-medium leading-none tracking-tight text-[#6ec8e8]"
            : "font-mono text-[56px] font-medium leading-none tracking-tight text-white"
        }
      >
        {value}
      </p>
      <div className="mt-5 h-px w-full bg-white/35" />
      <p className="mt-4 font-mono text-[16px] uppercase tracking-[1.6px] text-white">{label}</p>
      <p className="mt-2 text-[16px] text-zinc-400">{body}</p>
    </div>
  );
}

export function PitchWebTractionSlide() {
  return (
    <div className="flex h-full flex-col gap-5" data-pitch-web-slide="traction">
      <div>
        <PitchWebKicker>07 // TRACTION</PitchWebKicker>
        <PitchWebHeadline
          lines={[
            { text: "Our first customers" },
            { text: "and early prospects", tone: "cyan" },
          ]}
        />
      </div>
      <div className="grid min-h-0 flex-1 grid-cols-[1.15fr_0.85fr] items-stretch gap-5">
        <div className="grid h-full min-h-0 grid-cols-3 items-stretch gap-4">
          <StatCard value="01" label="First customer" body="The WISER (thewiser.org)" />
          <StatCard value="2" label="Courses authored" body="Authored for The WISER" />
          <StatCard value="~$20K" label="Full unit" body="Now being authored" accent />
        </div>
        <aside className="flex h-full min-h-0 flex-col border border-white/55 bg-[#071820] px-6 py-5">
          <p className="text-center font-mono text-[13px] uppercase tracking-[1.8px] text-[#6ec8e8]">
            Partner track // Proven Validation
          </p>
          <div className="mt-5 border border-[#6ec8e8] px-3 py-2 text-center font-mono text-[14px] uppercase tracking-[1.4px] text-[#6ec8e8]">
            Status: in progress
          </div>
          <div className="mt-3 border border-[#6ec8e8]/80 px-3 py-2 text-center font-mono text-[14px] uppercase tracking-[1.2px] text-[#6ec8e8]">
            Proven Validation // soft skills
          </div>
          <p className="my-2 text-center text-xl text-[#6ec8e8]">+</p>
          <div className="border border-[#6ec8e8] px-3 py-2 text-center font-mono text-[14px] uppercase tracking-[1.2px] text-[#6ec8e8]">
            Uncertain Systems // hard skills
          </div>
          <p className="mt-5 text-center text-[16px] leading-snug text-zinc-400">
            Co-founded by John Kerr, one of the fathers of Agile
          </p>
          <div className="mt-4 border border-dashed border-[#6ec8e8]/80 px-3 py-3 text-center">
            <p className="font-mono text-[14px] uppercase tracking-[1.4px] text-[#6ec8e8]">
              ASML // early prospect
            </p>
            <p className="mt-1 text-[14px] text-zinc-400">via Proven</p>
          </div>
          <p className="mt-4 text-center font-mono text-[13px] uppercase tracking-[1.4px] text-[#6ec8e8]">
            Together: hard-skill validation in their portfolio.
          </p>
        </aside>
      </div>
    </div>
  );
}
