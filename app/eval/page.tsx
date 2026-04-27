"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SolutionsBand } from "@/components/SolutionsBand";
import { RoadmapBadge } from "@/components/FeatureStatus";
import { LeadCapture } from "@/components/LeadCapture";
import { DemoBanner } from "@/components/DemoBanner";
import { useI18n } from "@/lib/i18n";

type Mode = "session" | "plan";

export default function EvalPage() {
  const { t } = useI18n();
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  const evalTopics = [
    { topic: t('eval.topic1'), category: t('eval.categoryTechnical'), emoji: "🌳" },
    { topic: t('eval.topic2'), category: t('eval.categoryDatabase'), emoji: "🗃️" },
    { topic: t('eval.topic3'), category: t('eval.categorySystemDesign'), emoji: "🔗" },
    { topic: t('eval.topic4'), category: t('eval.categoryAlgorithms'), emoji: "📊" },
  ];

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />
      <SolutionsBand />

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-[60%_40%]">
        {/* Left Column - Scrollable with lighter background (shows below on mobile) */}
        <div className="order-2 lg:order-1 bg-slate-900/40 lg:border-r border-t lg:border-t-0 border-slate-800 lg:h-[calc(100vh-113px)] lg:overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="w-full flex flex-col gap-8">
            {/* Mockup */}
            <div className="rounded-2xl border border-slate-700 bg-slate-800/30 overflow-hidden flex flex-col relative">
              <RoadmapBadge label={t('eval.reportPreview')} eta={t('eval.q2')} />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{t('eval.assessmentResults')}</span>
                <span className="text-xs text-slate-500">{t('eval.sampleReport')}</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="flex items-center gap-6 mb-4">
                  <div className="w-20 h-20 rounded-full border-4 border-emerald-500 flex items-center justify-center">
                    <span className="text-xl font-bold text-emerald-400">78%</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-1">{t('eval.overallProficient')}</h3>
                    <p className="text-sm text-slate-400">Python, SQL, System Design</p>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { skill: t('eval.skillAlgorithms'), score: 85, status: t('eval.advanced') },
                    { skill: t('eval.skillSystemDesign'), score: 72, status: t('eval.proficient') },
                    { skill: t('eval.skillSQL'), score: 91, status: t('eval.advanced') },
                    { skill: t('eval.skillDebugging'), score: 64, status: t('eval.needsWork') },
                  ].map(({ skill, score, status }) => (
                    <div key={skill} className="bg-slate-700/50 rounded-xl p-3 flex flex-col justify-center">
                      <p className="text-xs text-slate-400 mb-1.5">{skill}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-white">{score}%</span>
                        <span className={`text-[10px] px-2 py-0.5 rounded ${
                          status === t('eval.advanced') ? "bg-emerald-500/20 text-emerald-400" :
                          status === t('eval.proficient') ? "bg-blue-500/20 text-blue-400" :
                          "bg-amber-500/20 text-amber-400"
                        }`}>{status}</span>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700">
                  <p className="text-xs text-slate-500">
                    {t('eval.mockupQuote')}
                  </p>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('eval.problemTitle')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('eval.problem1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('eval.problem2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('eval.problem3')}</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">{t('eval.howItHelps')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('eval.solution1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('eval.solution2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('eval.solution3')}</span>
                </li>
              </ul>
            </div>

            {/* Trust Elements */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <span className="text-2xl mb-2 block">⚖️</span>
                <p className="text-xs text-slate-400">{t('eval.fairConsistent')}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <span className="text-2xl mb-2 block">📊</span>
                <p className="text-xs text-slate-400">{t('eval.detailedReports')}</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4 text-center">
                <span className="text-2xl mb-2 block">📈</span>
                <p className="text-xs text-slate-400">{t('eval.scalableScreening')}</p>
              </div>
            </div>

            {/* Disclaimer */}
            <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-4">
              <p className="text-xs text-amber-400/80">
                {t('eval.disclaimer')}
              </p>
            </div>

            {/* Lead Capture Form */}
            <LeadCapture 
              audience="hr"
              title={t('eval.requestDemo')}
              subtitle={t('eval.demoSubtitle')}
            />
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-4">
          <div className="w-full flex flex-col">
            {/* Solution Label */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest">{t('eval.label')}</span>
            </div>

            {/* Mode Toggle */}
            <div className="flex justify-center mb-5">
              <div className="bg-slate-900/80 rounded-xl p-1 flex gap-1 border border-slate-800">
                <button
                  onClick={() => setMode("session")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "session"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  {t('eval.assessNow')}
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  {t('eval.buildAssessment')}
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    {t('eval.title')}
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    {t('eval.subtitle')}
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder={t('eval.placeholder')}
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    {t('eval.orTryOne')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {evalTopics.map(({ topic, category, emoji }) => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className="text-left p-3 rounded-xl border border-slate-800 bg-slate-900/50 hover:bg-slate-800/80 hover:border-slate-600 transition-all duration-200"
                      >
                        <p className="text-[13px] text-slate-300 hover:text-white leading-snug mb-1.5">
                          {topic}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{emoji}</span>
                          <span className="text-[11px] text-slate-600">{category}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {mode === "plan" && (
              <div className="w-full flex-1 flex flex-col">
                <PlanModeSelect 
                  theme="slate"
                  title={t('eval.buildAssessment')}
                  placeholder={t('eval.placeholder')}
                  showYouTubeTab={false}
                />
              </div>
            )}
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
