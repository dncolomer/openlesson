"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SolutionsBand } from "@/components/SolutionsBand";
import { RoadmapBadge } from "@/components/FeatureStatus";
import { DemoBanner } from "@/components/DemoBanner";
import { useI18n } from "@/lib/i18n";

type Mode = "session" | "plan";

export default function HomeschoolPage() {
  const { t } = useI18n();
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  const homeschoolTopics = [
    { topic: t('homeschool.topic1'), category: t('homeschool.categoryMath'), emoji: "✖️" },
    { topic: t('homeschool.topic2'), category: t('homeschool.categoryHistory'), emoji: "🌍" },
    { topic: t('homeschool.topic3'), category: t('homeschool.categoryScience'), emoji: "🌱" },
    { topic: t('homeschool.topic4'), category: t('homeschool.categoryMath'), emoji: "½" },
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
              <RoadmapBadge label={t('homeschool.mockupLabel')} eta={t('homeschool.mockupEta')} />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{t('homeschool.mockupTitle')}</span>
                <span className="text-xs text-slate-500">{t('homeschool.mockupView')}</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="grid grid-cols-2 gap-3 mb-4">
                  <div className="bg-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                      👧
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">Emma</p>
                      <p className="text-[10px] text-slate-500">{t('homeschool.gradeLabel')} 4</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-emerald-400">85%</p>
                      <p className="text-[10px] text-slate-500">{t('homeschool.categoryMath')}</p>
                    </div>
                  </div>
                  <div className="bg-slate-700/50 rounded-xl p-3 flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-600 flex items-center justify-center text-lg">
                      👦
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">Lucas</p>
                      <p className="text-[10px] text-slate-500">{t('homeschool.gradeLabel')} 7</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-amber-400">72%</p>
                      <p className="text-[10px] text-slate-500">{t('homeschool.categoryScience')}</p>
                    </div>
                  </div>
                </div>
                <div className="bg-slate-700/30 rounded-xl p-4">
                  <p className="text-xs text-slate-400 mb-2">{t('homeschool.recentSessions')}</p>
                  <div className="space-y-2">
                    {[
                      { child: "Emma", topic: t('homeschool.mockupTopic1'), result: t('homeschool.strongLabel'), time: `2${t('homeschool.hoursAgo')}` },
                      { child: "Lucas", topic: t('homeschool.mockupTopic2'), result: t('homeschool.gapsLabel'), time: t('homeschool.yesterday') },
                      { child: "Emma", topic: t('homeschool.mockupTopic3'), result: t('homeschool.reviewLabel'), time: `2 ${t('homeschool.daysAgo')}` },
                    ].map(({ child, topic, result, time }) => (
                      <div key={`${child}-${topic}`} className="flex items-center justify-between py-1.5 border-b border-slate-700 last:border-0">
                        <div className="flex items-center gap-2">
                          <span className="text-xs text-white">{child}</span>
                          <span className="text-xs text-slate-600">•</span>
                          <span className="text-xs text-slate-400">{topic}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-[10px] px-2 py-0.5 rounded ${
                            result === t('homeschool.strongLabel') ? "bg-emerald-500/20 text-emerald-400" :
                            result === t('homeschool.gapsLabel') ? "bg-amber-500/20 text-amber-400" :
                            "bg-rose-500/20 text-rose-400"
                          }`}>{result}</span>
                          <span className="text-[10px] text-slate-600">{time}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="mt-4 pt-4 border-t border-slate-700 flex items-center justify-between">
                  <span className="text-xs text-slate-500">{t('homeschool.curriculumLabel')} {t('homeschool.stateStandards')} ✓</span>
                  <button className="text-xs bg-slate-600/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                    {t('homeschool.addChild')}
                  </button>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('homeschool.problemTitle')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('homeschool.problem1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('homeschool.problem2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('homeschool.problem3')}</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">{t('homeschool.howItHelps')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('homeschool.solution1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('homeschool.solution2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('homeschool.solution3')}</span>
                </li>
              </ul>
            </div>

            {/* Affordability Message */}
            <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-4">
              <p className="text-sm text-emerald-400 font-medium mb-1">
                {t('homeschool.affordabilityTitle')}
              </p>
              <p className="text-xs text-slate-400">
                {t('homeschool.affordabilitySubtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-4">
          <div className="w-full flex flex-col">
            {/* Solution Label */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest">{t('homeschool.label')}</span>
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
                  {t('homeschool.startLesson')}
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  {t('homeschool.buildCurriculum')}
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    {t('homeschool.title')}
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    {t('homeschool.subtitle')}
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder={t('homeschool.placeholder')}
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    {t('homeschool.popularTopics')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {homeschoolTopics.map(({ topic, category, emoji }) => (
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
                  title={t('homeschool.buildCurriculum')}
                  subtitle={t('homeschool.buildCurriculumSubtitle')}
                  placeholder={t('homeschool.placeholder')}
                  exampleTopics={t('homeschool.buildCurriculumExamples').split(', ')}
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
