"use client";

import { AgenticModeSelect } from "@/components/AgenticModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SolutionsBand } from "@/components/SolutionsBand";
import { DemoBanner } from "@/components/DemoBanner";

export default function AgentPage() {
  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />
      <SolutionsBand />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Left Column - Scrollable content */}
        <div className="order-2 lg:order-1 bg-[#0a0a0a] lg:border-r border-t lg:border-t-0 border-slate-800 lg:h-[calc(100vh-113px)] lg:overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="w-full flex flex-col gap-8">
            {/* Hero Section */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-3">Give Your AI Agent a Brain for Teaching</h2>
              <p className="text-slate-400 leading-relaxed">
                OpenLesson&apos;s Agent API v2 turns any autonomous agent into a world-class personal tutor. Plug in your
                ElizaOS character, OpenClaw agent, Hermes plugin — or call the HTTP API directly — and let openLesson
                handle the pedagogy, gap analysis, and proof-of-work.
              </p>
            </div>

            {/* The Challenge */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                  <span className="text-red-400 text-sm">!</span>
                </span>
                The Challenge
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>LLMs are great conversationalists but terrible tutors — no memory of what the learner actually knows</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Building your own curriculum, gap analysis, and progress tracking from scratch takes months</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>No way to cryptographically prove that learning actually happened</span>
                </li>
              </ul>
            </div>

            {/* The Solution */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <span className="w-8 h-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-emerald-400 text-sm">✓</span>
                </span>
                How OpenLesson Helps
              </h3>
              <ul className="space-y-3">
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Generate adaptive learning plans from any topic with a single POST request</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Multimodal analysis heartbeat — feed in audio, text, or images and get back probes and guidance</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Every learning action produces a SHA-256 proof, optionally anchored on Solana</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Scoped API keys, pause/resume sessions, full transcripts, and per-session analytics</span>
                </li>
              </ul>
            </div>

            {/* API Highlight */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75 22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3-4.5 16.5" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Drop-in Agent API v2</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Base URL: <code className="text-blue-400">/api/v2/agent</code>. Full endpoint surface for plans, sessions,
                    multimodal analysis, teaching assistant Q&amp;A, cryptographic proofs, and analytics. Pro subscription required.
                  </p>
                </div>
              </div>
            </div>

            {/* Proof-of-work highlight */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12c0 1.268-.63 2.39-1.593 3.068a3.745 3.745 0 0 1-1.043 3.296 3.745 3.745 0 0 1-3.296 1.043A3.745 3.745 0 0 1 12 21c-1.268 0-2.39-.63-3.068-1.593a3.746 3.746 0 0 1-3.296-1.043 3.745 3.745 0 0 1-1.043-3.296A3.745 3.745 0 0 1 3 12c0-1.268.63-2.39 1.593-3.068a3.745 3.745 0 0 1 1.043-3.296 3.746 3.746 0 0 1 3.296-1.043A3.746 3.746 0 0 1 12 3c1.268 0 2.39.63 3.068 1.593a3.746 3.746 0 0 1 3.296 1.043 3.746 3.746 0 0 1 1.043 3.296A3.745 3.745 0 0 1 21 12Z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Proof-of-Learning</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    Every session generates cryptographic proofs (SHA-256 fingerprints, Merkle batches) that can be anchored
                    on Solana. Verifiable, portable credentials for the learner — auditable progress for the platform.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-4 relative overflow-hidden">
          {/* Animated gradient background */}
          <div
            className="absolute inset-0"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, rgba(139, 92, 246, 0.25), transparent 50%), radial-gradient(circle at 80% 70%, rgba(59, 130, 246, 0.25), transparent 50%), radial-gradient(circle at 50% 50%, rgba(16, 185, 129, 0.15), transparent 60%), #0a0a0a",
            }}
          />
          <div className="absolute inset-0 backdrop-blur-sm bg-[#0a0a0a]/40" />

          <div className="w-full flex flex-col relative z-10 max-w-2xl mx-auto">
            {/* Label */}
            <div className="flex justify-center mb-3">
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">Agent API v2</span>
            </div>

            <div className="text-center mb-6">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                Plug in Your Agent
              </h2>
              <p className="text-white/70 max-w-md mx-auto text-sm leading-relaxed">
                Pick a framework integration or call the API directly.
              </p>
            </div>

            <AgenticModeSelect />
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
