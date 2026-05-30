"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Home, MousePointerClick } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { RabbitHoleNode, RabbitHolePlayStatus, RabbitHoleTopQuestion } from "@/lib/rabbit-hole";

const BACKGROUNDS = [
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/galactic-stoneworks/HH611QUbYAAOvrQ.jpeg",
  "/aesthetics/galactic-stoneworks/HH-rSf2bUAAy30f.jpeg",
  "/aesthetics/architecture/HHfAOzYWYAAhCDa.jpeg",
];

type Stage = "feed" | "dive" | "interview" | "done";
type PathItem = { id: string; question: string; depth: number };
type Interview = { question: string; choices: string[]; correctIndex: number; rationale: string };

const FALLBACK_BRANCHES = [
  ["What part of that question feels most personal to you?", "What part of that question feels bigger than just you?"],
  ["Where did that instinct first start showing up?", "What pattern does this reveal across other parts of your life?"],
  ["What would you protect about that interest if nobody else understood it?", "What assumption would you need to question next?"],
  ["Which detail keeps pulling your attention back?", "What would someone very different from you notice here?"],
  ["What kind of challenge would make this more alive?", "What tradeoff sits underneath this interest?"],
  ["What would you want to test through direct experience?", "What evidence would make you rethink your pull toward this?"],
  ["Who would you want to discuss this with, and why them?", "What larger system might this curiosity belong to?"],
  ["What would change if you gave this curiosity more room?", "What would this become if you pursued it for a year?"],
  ["What small signal would tell you this path is worth continuing?", "What would you need to stop doing to follow this honestly?"],
  ["What is the quietest version of this curiosity that still feels true?", "What deeper question is this question trying to become?"],
];

function withFallbackChildren(node: RabbitHoleNode): RabbitHoleNode {
  if (node.children.length > 0 || node.depth >= 10) return node;
  const branches = FALLBACK_BRANCHES[node.depth] ?? FALLBACK_BRANCHES[FALLBACK_BRANCHES.length - 1];
  return {
    ...node,
    children: branches.map((question, branchIndex) => ({
      id: `${node.id}:fallback:${branchIndex}`,
      question,
      depth: node.depth + 1,
      children: [],
    })),
  };
}

function randomCategoryStartIndex(questions: RabbitHoleTopQuestion[]) {
  const byCategory = new Map<string, number[]>();
  questions.forEach((question, questionIndex) => {
    const category = question.discipline ?? "Uncategorized";
    byCategory.set(category, [...(byCategory.get(category) ?? []), questionIndex]);
  });
  const categories = Array.from(byCategory.keys());
  const category = categories[Math.floor(Math.random() * categories.length)];
  const indexes = byCategory.get(category) ?? [];
  return indexes[Math.floor(Math.random() * indexes.length)] ?? 0;
}

export default function RabbitHolePage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const [questions, setQuestions] = useState<RabbitHoleTopQuestion[]>([]);
  const [status, setStatus] = useState<RabbitHolePlayStatus | null>(null);
  const [index, setIndex] = useState(0);
  const [stage, setStage] = useState<Stage>("feed");
  const [root, setRoot] = useState<RabbitHoleTopQuestion | null>(null);
  const [node, setNode] = useState<RabbitHoleNode | null>(null);
  const [path, setPath] = useState<PathItem[]>([]);
  const [interview, setInterview] = useState<Interview | null>(null);
  const [playId, setPlayId] = useState<string | null>(null);
  const [result, setResult] = useState<{ correct: boolean; score: number } | null>(null);
  const [loading, startTransition] = useTransition();
  const [message, setMessage] = useState("");
  const [finalizing, setFinalizing] = useState(false);
  const [interviewDepth, setInterviewDepth] = useState(10);
  const [touchStart, setTouchStart] = useState<{ x: number; y: number } | null>(null);
  const [dragY, setDragY] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [feedAnimating, setFeedAnimating] = useState(false);
  const [diveAnimating, setDiveAnimating] = useState(false);

  const current = questions[index % Math.max(questions.length, 1)];
  const previous = questions.length ? questions[(index - 1 + questions.length) % questions.length] : null;
  const next = questions.length ? questions[(index + 1) % questions.length] : null;
  const background = BACKGROUNDS[index % BACKGROUNDS.length];
  const outOfPlays = status ? status.playsAvailable <= 0 : false;

  useEffect(() => {
    supabase.auth.getUser().then((result: { data: { user: unknown | null } }) => {
      if (!result.data.user) router.push("/login?redirect=/rabbit-hole");
    });
  }, [router, supabase]);

  useEffect(() => {
    const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    Promise.all([
      fetch(`/api/rabbit-hole/status?timezone=${encodeURIComponent(timezone)}`).then((res) => res.json()),
      fetch("/api/rabbit-hole/questions").then((res) => res.json()),
    ]).then(([statusPayload, questionPayload]) => {
      if (!statusPayload.error) setStatus(statusPayload);
      if (!questionPayload.error) {
        const loadedQuestions = questionPayload.questions ?? [];
        setQuestions(loadedQuestions);
        setIndex(randomCategoryStartIndex(loadedQuestions));
      }
    });
  }, []);

  useEffect(() => {
    if (stage === "dive" && node && !loading && !finalizing && (node.depth >= interviewDepth || node.children.length === 0)) {
      surface();
    }
  }, [stage, node, loading, finalizing, interviewDepth]);

  function move(delta: number) {
    if (!questions.length) return;
    setFeedAnimating(true);
    setDragY(delta > 0 ? -window.innerHeight : window.innerHeight);
    window.setTimeout(() => {
      setIndex((value) => (value + delta + questions.length) % questions.length);
      setFeedAnimating(false);
      setDragY(0);
    }, 170);
  }

  function dive(question: RabbitHoleTopQuestion) {
    if (outOfPlays) return;
    const start = withFallbackChildren(question.tree ?? { id: question.id, question: question.question, depth: 0, children: [] });
    setRoot(question);
    setNode(start);
    setPath([{ id: start.id, question: start.question, depth: start.depth }]);
    setInterviewDepth(6 + Math.floor(Math.random() * 5));
    setFinalizing(false);
    setStage("dive");
  }

  function choose(next: RabbitHoleNode) {
    setNode(withFallbackChildren(next));
    setPath((items) => [...items, { id: next.id, question: next.question, depth: next.depth }]);
  }

  function handleTouchEnd(x: number, y: number) {
    if (finalizing) return;
    if (!touchStart) return;
    const dx = x - touchStart.x;
    const dy = y - touchStart.y;
    const absX = Math.abs(dx);
    const absY = Math.abs(dy);
    setTouchStart(null);

    if (stage === "feed") {
      if (absY > 90 && absY > absX) move(dy < 0 ? 1 : -1);
      else {
        setFeedAnimating(true);
        setDragY(0);
        window.setTimeout(() => setFeedAnimating(false), 180);
        if (absY < 18 && absX < 18 && current) dive(current);
      }
      return;
    }

    if (stage === "dive" && node) {
      if (absX > 55 && absX > absY && node.children.length) {
        setDiveAnimating(true);
        setDragX(dx < 0 ? -window.innerWidth : window.innerWidth);
        window.setTimeout(() => {
          choose(node.children[dx < 0 ? 1 : 0] ?? node.children[0]);
          setDiveAnimating(false);
          setDragX(0);
        }, 170);
      } else {
        setDiveAnimating(true);
        setDragX(0);
        window.setTimeout(() => setDiveAnimating(false), 180);
      }
    }
  }

  function surface() {
    if (!root || finalizing) return;
    setFinalizing(true);
    startTransition(async () => {
      setMessage("Preparing one final question...");
      const res = await fetch("/api/rabbit-hole/interview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topQuestionId: root.id, path, timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      const payload = await res.json();
      if (!res.ok) {
        setMessage(payload.error || "Could not finish this dive.");
        setFinalizing(false);
        return;
      }
      setPlayId(payload.playId);
      setInterview(payload.interview);
      setStage("interview");
      setMessage("");
    });
  }

  function answer(choiceIndex: number) {
    startTransition(async () => {
      const res = await fetch("/api/rabbit-hole/answer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playId, choiceIndex }),
      });
      const payload = await res.json();
      if (res.ok) {
        setResult(payload);
        setStage("done");
        const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
        const statusPayload = await fetch(`/api/rabbit-hole/status?timezone=${encodeURIComponent(timezone)}`).then((r) => r.json());
        if (!statusPayload.error) setStatus(statusPayload);
      }
    });
  }

  async function unlockPlays() {
    const res = await fetch("/api/stripe/create-checkout", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ priceType: "rabbit_hole_plays" }),
    });
    const payload = await res.json();
    if (payload.url) window.location.href = payload.url;
  }

  async function share(platform: string) {
    const text = encodeURIComponent(`I went ${path.length} questions deep in Rabbit Hole by OpenLesson.`);
    const url = encodeURIComponent(window.location.origin + "/rabbit-hole");
    const targets: Record<string, string> = {
      X: `https://twitter.com/intent/tweet?text=${text}&url=${url}`,
      LinkedIn: `https://www.linkedin.com/sharing/share-offsite/?url=${url}`,
      Instagram: "https://www.instagram.com/",
    };
    window.open(targets[platform], "_blank", "noopener,noreferrer");
    if (playId) {
      const payload = await fetch("/api/rabbit-hole/share", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ playId }) }).then((res) => res.json());
      setMessage(`Shared. Bonus unlocked: ${payload.bonusPlays} extra play${payload.bonusPlays === 1 ? "" : "s"}.`);
    }
  }

  async function continueFullLesson() {
    if (!root) return;
    const res = await fetch("/api/rabbit-hole/continue", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rootQuestion: root.question }) });
    const payload = await res.json();
    if (payload.planId) router.push(`/plan/${payload.planId}`);
  }

  return (
    <main className="h-[100svh] overflow-hidden overscroll-none bg-[#0a0a0a] text-zinc-100 [touch-action:none]">
      {BACKGROUNDS.map((image, bgIndex) => (
        <div
          key={image}
          className={`rabbit-hole-bg fixed -inset-8 bg-cover bg-center transition-opacity duration-500 ${image === background ? "opacity-100" : "opacity-0"}`}
          style={{
            backgroundImage: `url(${image})`,
            animationDuration: `${28 + (bgIndex % 4) * 7}s`,
            animationDelay: `-${(bgIndex % 5) * 5}s`,
            animationDirection: bgIndex % 2 === 0 ? "normal" : "reverse",
          }}
        />
      ))}
      <div className={`fixed inset-0 transition-colors duration-500 ${stage === "dive" ? "bg-[#10100c]/74" : "bg-black/64"}`} />
      <style jsx global>{`
        @keyframes rabbit-hole-bg-pan {
          0% { transform: scale(1.05) translate3d(-1.8%, -1.2%, 0); }
          28% { transform: scale(1.075) translate3d(1.4%, -0.4%, 0); }
          62% { transform: scale(1.06) translate3d(0.8%, 1.5%, 0); }
          100% { transform: scale(1.05) translate3d(-1.8%, -1.2%, 0); }
        }

        .rabbit-hole-bg {
          animation-name: rabbit-hole-bg-pan;
          animation-timing-function: ease-in-out;
          animation-iteration-count: infinite;
          filter: brightness(1.18) contrast(1.04) saturate(1.04);
          will-change: transform;
        }
      `}</style>
      <div className="relative z-10 mx-auto flex h-[100svh] w-full max-w-7xl flex-col px-5 py-5 sm:px-8 lg:px-10">
        <header className="pointer-events-none fixed left-5 right-5 top-5 z-20 flex items-center justify-between gap-4 sm:left-8 sm:right-8 lg:static lg:pointer-events-auto">
          <div />
          <div className="pointer-events-auto flex h-8 overflow-hidden rounded-full bg-black text-xs font-semibold leading-none ring-1 ring-white/10">
            <button onClick={() => router.push("/")} className="flex w-9 items-center justify-center text-white/80 transition hover:bg-zinc-900 hover:text-white" aria-label="Go to landing page"><Home size={15} strokeWidth={1.8} /></button>
            <div className="flex items-center px-4 text-white/80">{status ? `${status.playsAvailable} play${status.playsAvailable === 1 ? "" : "s"}` : "Loading"}</div>
            <button onClick={unlockPlays} className="flex items-center bg-white px-4 text-black transition hover:bg-[#f2ead7] active:scale-[0.98]">+3 for $1.99</button>
          </div>
        </header>

        <section className={`relative grid min-h-0 flex-1 gap-6 lg:grid-cols-[0.7fr_1.3fr] lg:items-center lg:py-16 ${stage === "feed" ? "pt-[17svh] pb-6" : "pt-16 pb-6"}`}>
          <aside className="hidden space-y-4 lg:block">
            <div className="flex items-center gap-3">
              <button onClick={() => router.push("/")} className="flex h-8 w-8 items-center justify-center rounded-sm bg-black text-white/80 ring-1 ring-white/10 transition hover:bg-zinc-900 hover:text-white active:scale-95" aria-label="Go to landing page"><Home size={15} strokeWidth={1.8} /></button>
              <div className="inline-block rounded-sm border border-zinc-800 bg-zinc-950/85 px-3 py-1 font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Rabbit Hole</div>
            </div>
            <h1 className="max-w-xl text-5xl font-medium leading-[1.02] tracking-[-2.7px] text-white sm:text-6xl">Discover what makes you tick.</h1>
            <p className="max-w-lg text-lg leading-relaxed text-zinc-400">One question a day. Follow only the threads that feel alive.</p>
            {outOfPlays && <button onClick={unlockPlays} className="rounded-sm border border-zinc-700 bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Out of plays today • Unlock 3 more for $1.99</button>}
            {message && <p className="text-sm text-zinc-300">{message}</p>}
          </aside>

          <div
            className={`min-h-0 overflow-hidden rounded-xl border border-white/10 bg-zinc-950/60 shadow-2xl backdrop-blur-md lg:min-h-[680px] lg:rounded-md lg:p-6 ${stage === "feed" ? "h-[calc(83svh-44px)] flex-none self-center lg:h-auto lg:flex-1" : "flex-1"}`}
            onTouchStart={(event) => {
              if (finalizing) return;
              setTouchStart({ x: event.touches[0].clientX, y: event.touches[0].clientY });
              setFeedAnimating(false);
              setDiveAnimating(false);
            }}
            onTouchMove={(event) => {
              if (!touchStart || finalizing) return;
              if (stage === "feed") {
                event.preventDefault();
                const nextY = event.touches[0].clientY - touchStart.y;
                setDragY(Math.max(-window.innerHeight * 0.92, Math.min(window.innerHeight * 0.92, nextY * 0.92)));
              }
              if (stage === "dive") {
                event.preventDefault();
                const nextX = event.touches[0].clientX - touchStart.x;
                setDragX(Math.max(-window.innerWidth * 0.88, Math.min(window.innerWidth * 0.88, nextX * 0.9)));
              }
            }}
            onTouchEnd={(event) => handleTouchEnd(event.changedTouches[0].clientX, event.changedTouches[0].clientY)}
          >
            {stage === "feed" && current && (
              <div className="relative h-full min-h-0 lg:min-h-[628px]">
                <div className={`absolute inset-x-0 top-0 h-full will-change-transform ${feedAnimating ? "transition-transform duration-200 ease-out" : ""}`} style={{ transform: `translate3d(0, calc(-100% + ${dragY}px), 0)` }}>
                  {previous && <FeedScreen question={previous} questionIndex={(index - 1 + questions.length) % questions.length} total={questions.length} />}
                </div>
                <button onClick={() => dive(current)} disabled={outOfPlays} className={`absolute inset-x-0 top-0 h-full text-left will-change-transform disabled:cursor-not-allowed disabled:opacity-50 ${feedAnimating ? "transition-transform duration-200 ease-out" : ""}`} style={{ transform: `translate3d(0, ${dragY}px, 0)` }}>
                  <FeedScreen question={current} questionIndex={index} total={questions.length} primary />
                </button>
                <div className={`absolute inset-x-0 top-0 h-full will-change-transform ${feedAnimating ? "transition-transform duration-200 ease-out" : ""}`} style={{ transform: `translate3d(0, calc(100% + ${dragY}px), 0)` }}>
                  {next && <FeedScreen question={next} questionIndex={(index + 1) % questions.length} total={questions.length} />}
                </div>
                <div className="pointer-events-none absolute bottom-8 left-5 flex items-center gap-2 rounded-full bg-black/45 px-3 py-2 text-white/35 ring-1 ring-white/10 lg:hidden" aria-hidden="true">
                  <ArrowUp size={15} strokeWidth={1.6} />
                  <ArrowDown size={15} strokeWidth={1.6} />
                </div>
                <div className="absolute inset-x-0 bottom-0 hidden items-center gap-3 lg:flex">
                  <button onClick={() => move(-1)} className="flex-1 rounded-sm border border-zinc-800 px-4 py-3 text-zinc-300 transition hover:border-zinc-600" aria-label="Previous question"><ArrowUp className="mx-auto" size={18} strokeWidth={1.7} /></button>
                  <button onClick={() => dive(current)} disabled={outOfPlays} className="flex-1 rounded-sm bg-white px-4 py-3 text-black transition hover:bg-zinc-200 disabled:opacity-40" aria-label="Dive in"><MousePointerClick className="mx-auto" size={18} strokeWidth={1.8} /></button>
                  <button onClick={() => move(1)} className="flex-1 rounded-sm border border-zinc-800 px-4 py-3 text-zinc-300 transition hover:border-zinc-600" aria-label="Next question"><ArrowDown className="mx-auto" size={18} strokeWidth={1.7} /></button>
                </div>
              </div>
            )}

            {stage === "dive" && node && (
              <div className="relative h-full min-h-0 overflow-hidden lg:min-h-[628px]">
                <div className={`absolute inset-y-0 left-0 w-full will-change-transform ${diveAnimating ? "transition-transform duration-200 ease-out" : ""}`} style={{ transform: `translate3d(calc(-100% + ${dragX}px), 0, 0)` }}>
                  <DiveBranchPreview label="Left" text={node.children[0]?.question ?? ""} />
                </div>
                <div className={`absolute inset-y-0 left-0 w-full will-change-transform ${diveAnimating ? "transition-transform duration-200 ease-out" : ""}`} style={{ transform: `translate3d(${dragX}px, 0, 0)` }}>
                  <DiveScreen node={node} />
                </div>
                <div className={`absolute inset-y-0 left-0 w-full will-change-transform ${diveAnimating ? "transition-transform duration-200 ease-out" : ""}`} style={{ transform: `translate3d(calc(100% + ${dragX}px), 0, 0)` }}>
                  <DiveBranchPreview label="Right" text={node.children[1]?.question ?? node.children[0]?.question ?? ""} />
                </div>
                {node.children.length > 0 && <div className="absolute inset-x-0 bottom-0 hidden gap-3 lg:grid lg:grid-cols-3">{node.children.slice(0, 3).map((child, childIndex) => <button key={child.id} onClick={() => choose(child)} className="rounded-sm border border-zinc-800 bg-black/20 p-4 text-left text-sm leading-relaxed text-zinc-300 transition hover:border-zinc-600 hover:text-white"><span className="mb-3 block font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Branch {childIndex + 1}</span>{child.question}</button>)}</div>}
              </div>
            )}

            {stage === "interview" && interview && (
              <div className="flex h-full min-h-0 flex-col justify-center px-5 py-6 lg:min-h-[628px] lg:px-0 lg:py-0">
                <p className="font-mono text-[10px] uppercase tracking-[3px] text-zinc-500">One final question</p>
                <h2 className="mt-5 text-[clamp(2.15rem,9vw,4.1rem)] font-medium leading-[1.01] tracking-[-0.07em] text-white lg:text-5xl">{interview.question}</h2>
                <div className="mt-7 grid gap-2.5 lg:gap-3">{interview.choices.map((choice, choiceIndex) => <button key={choice} onClick={() => answer(choiceIndex)} disabled={loading} className="rounded-md border border-white/10 bg-black/18 p-4 text-left text-base leading-snug text-zinc-300 transition hover:border-zinc-600 hover:text-white disabled:opacity-50 lg:rounded-sm lg:border-zinc-800 lg:text-base">{choice}</button>)}</div>
              </div>
            )}

            {stage === "done" && result && (
              <div className="flex h-full min-h-[488px] flex-col justify-center lg:min-h-[628px]">
                <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">Done for today</p>
                <h2 className="mt-5 text-5xl font-medium tracking-[-2px] text-white">{result.score} points</h2>
                <div className="mt-8 grid gap-3 text-sm text-zinc-400 sm:grid-cols-3"><div className="border border-zinc-800 p-4">Depth<br /><span className="text-2xl text-white">{Math.max(...path.map((item) => item.depth))}</span></div><div className="border border-zinc-800 p-4">Questions explored<br /><span className="text-2xl text-white">{path.length}</span></div><div className="border border-zinc-800 p-4">Final answer<br /><span className="text-2xl text-white">{result.correct ? "Correct" : "Missed"}</span></div></div>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row"><button onClick={() => share("X")} className="rounded-sm border border-zinc-800 px-4 py-3 text-sm text-zinc-300">Share on X</button><button onClick={() => share("Instagram")} className="rounded-sm border border-zinc-800 px-4 py-3 text-sm text-zinc-300">Instagram</button><button onClick={() => share("LinkedIn")} className="rounded-sm border border-zinc-800 px-4 py-3 text-sm text-zinc-300">LinkedIn</button></div>
                <button onClick={continueFullLesson} className="mt-4 rounded-sm bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-zinc-200">Continue this in full OpenLesson</button>
              </div>
            )}
            {finalizing && stage === "dive" && (
              <div className="absolute inset-0 z-40 flex flex-col items-center justify-center bg-black/72 px-6 text-center backdrop-blur-sm">
                <div className="font-mono text-[10px] uppercase tracking-[3px] text-zinc-500">Grok is listening</div>
                <div className="mt-4 max-w-sm text-3xl font-medium leading-tight tracking-[-1.4px] text-white">Preparing one final question.</div>
                <div className="mt-6 flex gap-1.5" aria-hidden="true">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45 [animation-delay:120ms]" />
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white/45 [animation-delay:240ms]" />
                </div>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function FeedScreen({ question, questionIndex, total, primary = false }: { question: RabbitHoleTopQuestion; questionIndex: number; total: number; primary?: boolean }) {
  return (
    <div className={`flex h-full min-h-0 flex-col justify-between px-6 pb-12 pt-5 lg:px-0 lg:pb-20 lg:pt-0 ${primary ? "opacity-100" : "opacity-75"}`}>
      <div className="h-4" />
      <div className="flex flex-1 items-center justify-center lg:my-8 lg:rounded-md lg:border lg:border-zinc-800 lg:bg-black/30 lg:p-8">
        <span className="text-[clamp(2.65rem,11.5vw,5rem)] font-medium leading-[0.98] tracking-[-0.06em] text-white lg:text-6xl lg:tracking-[-2.2px]">{question.question}</span>
      </div>
      {primary && (
        <div className="pointer-events-none absolute bottom-8 right-5 flex items-center gap-2 rounded-full bg-white px-3.5 py-2 text-xs font-semibold text-black shadow-xl lg:hidden">
          <MousePointerClick size={14} strokeWidth={1.8} />
          <span>Dive in</span>
        </div>
      )}
      <div className="h-5 lg:h-0" />
    </div>
  );
}

function DiveScreen({ node }: { node: RabbitHoleNode }) {
  return (
    <div className="flex h-full min-h-0 flex-col px-6 pb-16 pt-5 lg:px-0 lg:pb-36 lg:pt-0">
      <div className="h-4" />
      <div className="flex flex-1 items-center py-8">
        <h2 className="text-[clamp(3rem,13vw,6.2rem)] font-medium leading-[0.96] tracking-[-0.075em] text-[#f2ead7] lg:text-6xl lg:tracking-[-2.2px]">{node.question}</h2>
      </div>
      <div className="grid grid-cols-2 gap-3 lg:hidden">
        <div className="rounded-md border border-white/10 bg-[#15130f]/70 p-3 text-xs leading-relaxed text-zinc-100"><ArrowLeft className="mb-2 text-white/35" size={14} strokeWidth={1.6} />{node.children[0]?.question ?? ""}</div>
        <div className="rounded-md border border-white/10 bg-[#15130f]/70 p-3 text-xs leading-relaxed text-zinc-100"><ArrowRight className="mb-2 text-white/35" size={14} strokeWidth={1.6} />{node.children[1]?.question ?? node.children[0]?.question ?? ""}</div>
      </div>
    </div>
  );
}

function DiveBranchPreview({ label, text }: { label: string; text: string }) {
  return (
    <div className="flex h-full min-h-0 flex-col justify-center px-6 pb-16 pt-5 lg:px-0 lg:pb-36 lg:pt-0">
      <p className="font-mono text-[10px] uppercase tracking-[3px] text-zinc-500">{label}</p>
      <h2 className="mt-5 text-[clamp(2.7rem,12vw,5.8rem)] font-medium leading-[0.98] tracking-[-0.075em] text-[#f2ead7] lg:text-6xl">{text}</h2>
    </div>
  );
}
