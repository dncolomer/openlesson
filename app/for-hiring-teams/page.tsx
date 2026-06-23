"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowRight, Check, ChevronRight, Menu, Sparkles } from "lucide-react";
import { Footer } from "@/components/Footer";

const CAL_LINK = "https://cal.com/daniel-colomer-lvwg8w/openlesson-demo";

const examples = [
  {
    title: "Example 1 – Senior Product Manager (Prioritization under conflicting data)",
    traditional: "Candidate confidently recites RICE framework or describes a past successful prioritization. Strong, polished delivery.",
    openLesson: "Given a fresh, messy scenario with incomplete stakeholder data and new technical constraints: You see whether they mechanically apply frameworks or genuinely adapt them. Socratic probes reveal if \"user-centric\" is rhetoric or an actual decision filter. You observe how they handle the moment an assumption is gently challenged.",
  },
  {
    title: "Example 2 – ML / Data Engineer (Debugging novel model failure)",
    traditional: "Correctly identifies common failure modes from past experience or LeetCode-style debugging. Passes the test.",
    openLesson: "Presented with an unfamiliar model degradation on a new data distribution: The think-aloud trace shows their actual debugging strategy, hypothesis generation quality, and how they decide what to test next. You see whether they get stuck in local loops or systematically narrow the problem space — and how quickly they update beliefs when evidence contradicts their initial theory.",
  },
  {
    title: "Example 3 – Engineering Manager (Handling team performance issue)",
    traditional: "Gives textbook answer about 1:1s, feedback frameworks, or \"radical candor.\" Sounds leadership-ready.",
    openLesson: "Given an ambiguous, emotionally charged team scenario with incomplete information: You hear the real-time reasoning about what information they would gather first, how they balance empathy vs accountability, and whether they default to process or adapt to the human nuance. Socratic follow-ups surface their actual philosophy vs. rehearsed language.",
  },
  {
    title: "Example 4 – Strategy / Consulting (Structuring ill-defined problems)",
    traditional: "Beautiful MECE framework on a familiar case type. Clean slides, confident delivery.",
    openLesson: "Dropped into a genuinely open-ended client problem with noisy data and political stakeholders: The block reveals how they build (or fail to build) a working mental model from scratch, the quality of questions they ask themselves, and whether their structuring is generative or just pattern-matching from training cases. You see intellectual honesty when the AI probes a weak link in their logic.",
  },
];

const workSteps = [
  ["Define what matters.", "You (with our help) identify the 2–4 reasoning dimensions critical for the role and craft 1–2 challenge prompts that are novel enough to prevent memorized answers. We specialize in making these prompts diagnostic."],
  ["Candidate completes a 25–40 minute block.", "They receive the prompt and think aloud naturally using voice. The AI listens in real time and engages with targeted Socratic questions — exactly like your best interviewer would — to surface gaps, assumptions, and recovery patterns. No typing walls. No multiple-choice grids."],
  ["Receive rich, structured output.", "Your team gets a reasoning trace with highlighted key moments, assumption maps, communication clarity markers, and qualitative insights mapped to your dimensions. Not black-box scores — evidence you can review, discuss, and trust. Optionally query the block data conversationally (\"Where did this candidate show strong systems thinking?\")."],
  ["Human judgment + team debrief.", "Use the artifacts alongside your existing process. The goal is not to replace your interviewers but to give them dramatically better raw material for every candidate — consistently."],
];

const benefits = [
  "Higher predictive signal on the attributes that actually drive success in complex, evolving roles (learning agility, reasoning under ambiguity, clear communication of thought).",
  "Dramatically more consistent and fair evaluation across candidates and across different interviewers on your team.",
  "Scalable depth: Every candidate gets high-quality, expert-level probing without burning out your strongest interviewers.",
  "Better candidate experience: People get to demonstrate real thinking instead of performing under artificial constraints. Many candidates actually enjoy the format.",
  "Actionable, reviewable evidence that slots directly into your existing debriefs and scorecards — no need to rip and replace your process.",
  "Reduced bias risk through structured, recorded, reviewable blocks (strong GDPR / compliance posture for EU teams).",
];

const HERO_USER_QUESTION = "Which candidate thinks better about the product management prioritization question? I care less about polish and more about who would make the better real-world decision under ambiguity.";

const HERO_ANSWER_PARTS = [
  { kind: "paragraph", text: "Concrete answer: Candidate B is the stronger product thinker." },
  { kind: "paragraph", text: "Candidate A sounded more senior at first: they named RICE quickly, spoke fluently, and produced a clean roadmap answer. But their reasoning stayed framework-led. When the technical constraint changed, they defended the original ranking instead of rebuilding the decision model." },
  { kind: "paragraph", text: "Candidate B was less polished, but showed better judgment under ambiguity. They separated reversible from irreversible bets, asked which customer segment carried the highest downside risk, and revised their recommendation after the Socratic probe exposed a weak assumption about sales pressure." },
  { kind: "insight", text: "Hidden insight: Candidate B noticed that the loudest stakeholder was not necessarily closest to the user pain. That is the signal I would weight most: they resisted organizational noise without ignoring it." },
  { kind: "paragraph", text: "I would advance Candidate B and use the debrief to validate communication style, not reasoning quality. Candidate A needs a follow-up on adaptability when evidence contradicts the first framework." },
];

const HERO_ANSWER_TEXT = HERO_ANSWER_PARTS.map((part) => part.text).join("\n\n");

export default function ForHiringTeamsPage() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [showSticky, setShowSticky] = useState(false);

  useEffect(() => {
    const onScroll = () => setShowSticky(window.scrollY > window.innerHeight * 0.65);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] bg-cover bg-fixed bg-center text-zinc-200 selection:bg-zinc-700"
      style={{ backgroundImage: "linear-gradient(rgba(10,10,10,0.75), rgba(10,10,10,0.75)), url('/hr.jpg')" }}
    >

      <header className="sticky top-0 z-40 border-b border-zinc-900 bg-[#0a0a0a]/85 px-5 py-4 backdrop-blur-md">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link href="/" className="text-base font-semibold tracking-tight text-white transition hover:text-zinc-300">openLesson</Link>
          <nav className="hidden items-center gap-3 md:flex" aria-label="Hiring page navigation">
            <a href={CAL_LINK} className="rounded-sm bg-white px-4 py-2 text-sm font-medium text-black transition hover:bg-zinc-200">Book a Demo</a>
          </nav>
          <button onClick={() => setMenuOpen(!menuOpen)} className="rounded-sm border border-zinc-800 p-2 text-zinc-300 md:hidden" aria-label="Toggle menu"><Menu size={19} /></button>
        </div>
        {menuOpen && <div className="mx-auto mt-4 grid max-w-6xl gap-2 border-t border-zinc-900 pt-4 md:hidden"><a href={CAL_LINK} className="rounded-sm bg-white px-4 py-3 text-left text-sm font-medium text-black">Book a Demo</a></div>}
      </header>

      <section className="mx-auto grid min-h-[calc(100vh-73px)] w-full max-w-6xl items-center gap-12 px-6 py-20 lg:grid-cols-[1.08fr_0.92fr]">
        <div>
          <div className="mb-6 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">FOR HIRING TEAMS</div>
          <h1 className="max-w-4xl text-5xl font-medium leading-[1.03] tracking-[-2.8px] text-white sm:text-6xl lg:text-[70px]">Evaluate how candidates think — not just what they recall.</h1>
          <p className="mt-7 max-w-3xl text-lg leading-relaxed text-zinc-400">openLesson combines the think-aloud protocol with Socratic AI to reveal deep reasoning signals — how candidates explore unfamiliar problems, surface assumptions, revise their thinking, and communicate under ambiguity. Get structured evidence instead of another vibe-based interview or rigid test score.</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row"><a href={CAL_LINK} className="inline-flex min-h-12 items-center justify-center rounded-sm bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Book a 20-Minute Demo for Your Hiring Team</a></div>
          <p className="mt-6 font-mono text-[11px] uppercase tracking-[1.6px] text-zinc-500">GDPR-compliant • Candidate consent flows • Your data stays under your control</p>
        </div>
        <HeliosHiringMock />
      </section>

      <ContentSection eyebrow="THE PROBLEM" title="The Problem with How We Hire Today">
        <p>Most hiring processes for knowledge-work and complex roles optimize for the wrong things:</p>
        <BulletList items={["Memorized answers and polished interview performance (easy to game, poor predictor of on-the-job success).", "Inconsistent human judgment — different interviewers, different days, different standards. Comparison across candidates becomes noisy.", "Rigid tools and scorecards that force every role into the same generic metrics, even when your team cares about specific dimensions of thinking.", "High cost of mis-hires and slow ramps when the signal on learning agility and real problem-solving was weak."]} />
        <p>The result: You often discover too late whether someone can actually think through novel, ambiguous situations — exactly what most roles demand once the onboarding slides are over.</p>
      </ContentSection>

      <ContentSection eyebrow="THE DIFFERENCE" title="The openLesson Difference for Hiring Teams">
        <p>openLesson turns candidate assessment into a structured reasoning conversation that delivers clearer, more reliable signals.</p>
        <p className="text-white">What makes it different:</p>
        <BulletList items={["Core strength: You evaluate the quality of thinking and reasoning process, not just whether the final answer was \"correct.\"", "Deeper signal: Think-aloud protocol + Socratic method uncovers clearer and more honest signals about how candidates actually reason.", "Flexible & human-like: Fully conversational interface — explore candidate performance freely based on the competencies and goals that matter to your specific team and role, instead of being locked into rigid dashboards or generic metrics that rarely fit.", "Scalable consistency: It acts like a tireless, expert, bias-resistant hiring manager for every single candidate — consistent depth of probing, no fatigue, no mood swings, same high bar."]} />
      </ContentSection>

      <section className="mx-auto max-w-6xl px-6 py-20">
        <SectionHeading eyebrow="MISSED SIGNALS" title="What You Uncover That Traditional Tools Miss" />
        <div className="mt-10 grid gap-4">{examples.map((example) => <ExampleCard key={example.title} {...example} />)}</div>
        <div className="mt-6 border border-teal-400/20 bg-teal-950/20 p-6 text-lg leading-relaxed text-zinc-200">Traditional methods mostly test performance under known conditions or recall. openLesson tests performance under the exact conditions that matter most for complex roles — novelty, ambiguity, incomplete information, and the need to revise thinking in real time.</div>
      </section>

      <section className="mx-auto max-w-6xl px-6 py-20"><SectionHeading eyebrow="HOW IT WORKS" title="How It Works" /><div className="mt-10 grid gap-4 lg:grid-cols-4">{workSteps.map(([title, text], index) => <div key={title} className="border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700"><div className="mb-5 flex size-10 items-center justify-center rounded-sm bg-white text-sm font-semibold text-black">{index + 1}</div><h3 className="text-lg font-medium text-white">{title}</h3><p className="mt-3 text-sm leading-relaxed text-zinc-400">{text}</p></div>)}</div></section>

      <section className="mx-auto max-w-6xl px-6 py-20"><SectionHeading eyebrow="BENEFITS" title="Benefits for Hiring Teams & HR" /><div className="mt-10 grid gap-4 md:grid-cols-2">{benefits.map((benefit) => <div key={benefit} className="flex gap-4 border border-zinc-800 bg-zinc-950/70 p-5"><Check className="mt-1 shrink-0 text-teal-300" size={18} /><p className="leading-relaxed text-zinc-300">{benefit}</p></div>)}</div></section>

      <ContentSection eyebrow="IDEAL FOR" title="Ideal For">
        <p>Hiring teams in tech, SaaS, consulting, finance, R&D, and any organization where roles require strong independent reasoning, learning agility, and judgment under uncertainty.</p>
        <BulletList items={["Roles: Product Management, Software Engineering (especially senior/staff+), Data Science/ML, Strategy & Operations, Consulting, Research, Technical Program Management, Engineering Management.", "Company stage: Scale-ups and established companies tired of the \"great on paper, disappointing in reality\" pattern and the high cost of mis-hires.", "Current pain: Teams that have outgrown pure leetcode-style screens or unstructured interviews but still lack reliable signal on real thinking quality."]} />
      </ContentSection>

      <section className="mx-auto max-w-6xl px-6 py-24"><div className="border border-zinc-800 bg-zinc-950/80 p-8 text-center backdrop-blur-sm sm:p-12"><Sparkles className="mx-auto mb-5 text-teal-300" /><h2 className="mx-auto max-w-3xl text-4xl font-medium tracking-[-1.5px] text-white sm:text-5xl">Ready to see clearer reasoning signals from your next candidates?</h2><p className="mx-auto mt-6 max-w-3xl text-lg leading-relaxed text-zinc-400">Start with a no-risk pilot: We’ll run assessments for 3–5 candidates on one of your current open roles and deliver the full reasoning traces and insights for your team to review alongside your existing process.</p><div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row"><a href={CAL_LINK} className="rounded-sm bg-white px-6 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Book a Demo & Strategy Call</a></div><p className="mt-7 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">GDPR-compliant data handling • Candidate consent flows included • Sessions are recorded with explicit permission • Your data stays under your control</p></div></section>

      <Footer />
      <a href={CAL_LINK} className={`fixed bottom-5 right-5 z-40 hidden rounded-sm bg-white px-5 py-3 text-sm font-medium text-black shadow-2xl transition md:inline-flex ${showSticky ? "translate-y-0 opacity-100" : "pointer-events-none translate-y-4 opacity-0"}`}>Book a Demo <ChevronRight className="ml-1" size={16} /></a>
    </main>
  );
}

function HeliosHiringMock() {
  const [userChars, setUserChars] = useState(0);
  const [answerChars, setAnswerChars] = useState(0);
  const [isThinking, setIsThinking] = useState(false);
  const messagesRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let cancelled = false;
    const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

    async function play() {
      if (cancelled) return;

      setUserChars(0);
      setAnswerChars(0);
      setIsThinking(false);

      for (let index = 1; index <= HERO_USER_QUESTION.length; index += 1) {
        if (cancelled) return;
        setUserChars(index);
        await sleep(58);
      }

      await sleep(900);
      if (cancelled) return;
      setIsThinking(true);

      await sleep(2600);
      if (cancelled) return;
      setIsThinking(false);

      for (let index = 2; index <= HERO_ANSWER_TEXT.length; index += 2) {
        if (cancelled) return;
        setAnswerChars(Math.min(index, HERO_ANSWER_TEXT.length));
        await sleep(62);
      }

      await sleep(9000);
      void play();
    }

    void play();

    return () => {
      cancelled = true;
    };
  }, []);

  const typedQuestion = HERO_USER_QUESTION.slice(0, userChars);

  useEffect(() => {
    const messages = messagesRef.current;
    if (!messages) return;
    messages.scrollTop = messages.scrollHeight;
  }, [userChars, answerChars, isThinking]);

  return (
    <div className="border border-zinc-800/80 bg-zinc-950/75 p-4 shadow-2xl backdrop-blur-sm">
      <div className="flex h-[620px] flex-col overflow-hidden rounded-2xl border border-neutral-800 bg-neutral-950/40 p-4" aria-label="Mock Helios performance chat analyzing product management candidates">
        <div className="relative mb-3 flex-shrink-0 self-center">
          <div className="flex size-12 items-center justify-center rounded-full border border-neutral-600/40 bg-gradient-to-br from-neutral-700/40 via-neutral-800 to-neutral-900 ring-1 ring-neutral-600/25 ring-offset-1 ring-offset-transparent">
            <span className="font-serif text-lg text-neutral-200">H</span>
          </div>
          <div className="absolute inset-0 rounded-full shadow-[0_0_32px_rgba(255,255,255,0.08)]" />
        </div>

        <div ref={messagesRef} className="mb-3 min-h-0 flex-1 overflow-y-auto rounded-2xl border border-neutral-800 bg-neutral-950/50 p-4 overscroll-contain">
          <div className="space-y-4">
            {typedQuestion && (
              <ChatBubble role="user">
                {typedQuestion}<TypingCursor show={userChars < HERO_USER_QUESTION.length} />
              </ChatBubble>
            )}
            {isThinking && <ThinkingBubble />}
            {answerChars > 0 && (
              <ChatBubble role="assistant">
                <TypedAnswer chars={answerChars} />
                <TypingCursor show={answerChars < HERO_ANSWER_TEXT.length} />
              </ChatBubble>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-neutral-800 bg-neutral-950/40 p-2.5">
          <div className="flex items-end gap-2 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-1.5">
            <p className="min-h-6 flex-1 py-1 text-sm text-neutral-500">Ask about reasoning evidence, assumptions, or debrief notes...</p>
            <div className="rounded-lg p-1.5 text-neutral-300" aria-hidden="true">
              <svg className="size-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 12L3.269 3.126A59.768 59.768 0 0121.485 12 59.77 59.77 0 013.27 20.876L5.999 12zm0 0h7.5" />
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function TypedAnswer({ chars }: { chars: number }) {
  let remaining = chars;

  return (
    <>
      {HERO_ANSWER_PARTS.map((part, index) => {
        if (remaining <= 0) return null;
        const visibleText = part.text.slice(0, remaining);
        remaining -= part.text.length + 2;

        if (part.kind === "insight") {
          const [label, ...rest] = visibleText.split(": ");
          return (
            <div key={index} className="mt-3 rounded-lg border border-neutral-700/50 bg-neutral-900/70 p-3">
              <p className="text-neutral-200"><strong>{label}{rest.length > 0 ? ":" : ""}</strong>{rest.length > 0 ? ` ${rest.join(": ")}` : ""}</p>
            </div>
          );
        }

        return <p key={index}>{index === 0 ? <strong>{visibleText}</strong> : visibleText}</p>;
      })}
    </>
  );
}

function TypingCursor({ show }: { show: boolean }) {
  if (!show) return null;
  return <span className="ml-0.5 inline-block h-[1em] w-[2px] translate-y-0.5 animate-pulse bg-neutral-300/80" aria-hidden="true" />;
}

function ThinkingBubble() {
  return (
    <ChatBubble role="assistant">
      <div className="flex items-center gap-1 py-1" aria-label="Helios is thinking">
        <span className="size-1.5 animate-bounce rounded-full bg-neutral-400/70" style={{ animationDelay: "0ms" }} />
        <span className="size-1.5 animate-bounce rounded-full bg-neutral-400/70" style={{ animationDelay: "150ms" }} />
        <span className="size-1.5 animate-bounce rounded-full bg-neutral-400/70" style={{ animationDelay: "300ms" }} />
      </div>
    </ChatBubble>
  );
}

function ChatBubble({ role, children }: { role: "user" | "assistant"; children: React.ReactNode }) {
  const isUser = role === "user";

  return (
    <div className={`flex gap-2 ${isUser ? "flex-row-reverse" : ""}`}>
      <div className={`flex size-5 flex-shrink-0 items-center justify-center rounded-full ${isUser ? "bg-neutral-200" : "border border-neutral-600/40 bg-gradient-to-br from-neutral-700/40 via-neutral-800 to-neutral-900"}`}>
        {isUser ? (
          <svg className="size-2.5 text-black" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0M12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        ) : (
          <span className="font-serif text-[9px] text-neutral-300">H</span>
        )}
      </div>
      <div className={`min-w-0 flex-1 rounded-lg px-3 py-2 text-sm leading-6 ${isUser ? "rounded-br-sm bg-neutral-100 text-black" : "rounded-bl-sm border border-neutral-700/50 bg-neutral-800/70 text-neutral-200"}`}>
        <div className={`space-y-3 ${isUser ? "[&_strong]:text-black" : "[&_strong]:text-neutral-100"}`}>{children}</div>
      </div>
    </div>
  );
}

function ContentSection({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return <section className="mx-auto max-w-6xl px-6 py-20"><div className="grid gap-10 border border-zinc-800/70 bg-zinc-950/72 p-6 backdrop-blur-sm sm:p-8 lg:grid-cols-[0.8fr_1.2fr]"><SectionHeading eyebrow={eyebrow} title={title} /><div className="space-y-6 text-lg leading-relaxed text-zinc-300">{children}</div></div></section>;
}

function SectionHeading({ eyebrow, title }: { eyebrow: string; title: string }) {
  return <div><div className="mb-4 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">{eyebrow}</div><h2 className="max-w-3xl text-3xl font-medium tracking-[-1.4px] text-white sm:text-4xl">{title}</h2></div>;
}

function BulletList({ items }: { items: string[] }) {
  return <ul className="grid gap-3">{items.map((item) => <li key={item} className="flex gap-3"><ArrowRight className="mt-1.5 shrink-0 text-teal-300/80" size={16} /><span>{item}</span></li>)}</ul>;
}

function ExampleCard({ title, traditional, openLesson }: { title: string; traditional: string; openLesson: string }) {
  return <article className="border border-zinc-800 bg-zinc-950/70 p-5 transition hover:border-zinc-700"><h3 className="text-xl font-medium tracking-tight text-white">{title}</h3><div className="mt-5 grid gap-4 lg:grid-cols-2"><div className="border border-zinc-800 bg-black/30 p-4"><p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Traditional</p><p className="mt-3 leading-relaxed text-zinc-400">{traditional}</p></div><div className="border border-teal-400/20 bg-teal-950/10 p-4"><p className="font-mono text-[10px] uppercase tracking-[2px] text-teal-300/80">openLesson Uncovers</p><p className="mt-3 leading-relaxed text-zinc-300">{openLesson}</p></div></div></article>;
}
