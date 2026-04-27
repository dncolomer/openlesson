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

export default function SchoolsPage() {
  const { t } = useI18n();
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  const schoolsTopics = [
    { topic: t('schools.topic1'), category: t('schools.categoryMath2'), emoji: "📐" },
    { topic: t('schools.topic2'), category: t('schools.categoryEnglish'), emoji: "📝" },
    { topic: t('schools.topic3'), category: t('schools.categoryScience2'), emoji: "🧬" },
    { topic: t('schools.topic4'), category: t('schools.categoryScience2'), emoji: "⚡" },
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
              <RoadmapBadge label={t('schools.mockupLabel')} eta={t('schools.mockupEta')} />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{t('schools.mockupTitle')}</span>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded">{t('schools.activeLabel')}</span>
                  <span className="text-[10px] bg-amber-500/20 text-amber-400 px-1.5 py-0.5 rounded">{t('schools.inProgressLabel')}</span>
                </div>
              </div>
              <div className="p-4 flex flex-col">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-slate-700">
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 pr-2">{t('schools.studentHeader')}</th>
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 px-2">{t('schools.inProgressLabel')}</th>
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 px-2">{t('schools.lastCol')}</th>
                        <th className="text-left text-[10px] text-slate-400 font-medium pb-2 pl-2">{t('schools.gapsCol')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        { name: t('schools.studentName1'), status: t('schools.activeLabel'), last: `2${t('schools.hoursAgo')}`, gaps: 1 },
                        { name: t('schools.studentName2'), status: t('schools.activeLabel'), last: `3${t('schools.hoursAgo')}`, gaps: 0 },
                        { name: t('schools.studentName3'), status: t('schools.inProgressLabel'), last: t('schools.nowLabel'), gaps: 2 },
                        { name: t('schools.studentName4'), status: t('schools.notStartedLabel'), last: "—", gaps: 0 },
                        { name: t('schools.studentName5'), status: t('schools.activeLabel'), last: `1${t('schools.hoursAgo')}`, gaps: 3 },
                      ].map(({ name, status, last, gaps }) => (
                        <tr key={name} className="border-b border-slate-700/50 last:border-0">
                          <td className="py-2 pr-2">
                            <p className="text-sm text-white">{name}</p>
                          </td>
                          <td className="px-2 py-2">
                            <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                              status === t('schools.activeLabel') ? "bg-emerald-500/20 text-emerald-400" :
                              status === t('schools.inProgressLabel') ? "bg-amber-500/20 text-amber-400" :
                              "bg-slate-600/30 text-slate-400"
                            }`}>{status}</span>
                          </td>
                          <td className="px-2 py-2">
                            <span className="text-xs text-slate-500">{last}</span>
                          </td>
                          <td className="pl-2 py-2">
                            {gaps > 0 ? (
                              <span className="text-xs bg-rose-500/20 text-rose-400 px-1.5 py-0.5 rounded">{gaps}</span>
                            ) : (
                              <span className="text-xs text-emerald-400">✓</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{t('schools.googleClassroom')}</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded">{t('schools.canvas')}</span>
                  </div>
                  <button className="text-xs bg-slate-600/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                    {t('schools.createAssignment')}
                  </button>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('schools.problemTitle')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('schools.problem1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('schools.problem2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('schools.problem3')}</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">{t('schools.howItHelps')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('schools.solution1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('schools.solution2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('schools.solution3')}</span>
                </li>
              </ul>
            </div>

            {/* Lead Capture Form */}
            <LeadCapture 
              audience="schools"
              title={t('schools.leadTitle')}
              subtitle={t('schools.leadSubtitle')}
            />
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-4">
          <div className="w-full flex flex-col">
            {/* Label */}
            <div className="flex justify-center mb-3">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">{t('schools.label')}</span>
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
                  {t('schools.assignTopic')}
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  {t('schools.buildSyllabus')}
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    {t('schools.title')}
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    {t('schools.subtitle')}
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder={t('schools.placeholder')}
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    {t('schools.commonTopics')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {schoolsTopics.map(({ topic, category, emoji }) => (
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
                  title={t('schools.buildSyllabus')}
                  subtitle={t('schools.buildSyllabusSubtitle')}
                  placeholder={t('schools.placeholder')}
                  exampleTopics={t('schools.buildSyllabusExamples').split(', ')}
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
