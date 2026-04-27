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

const CERTIFICATION_BADGES = [
  "AWS", "GCP", "Azure", "PMP", "CompTIA", "CISSP", "CPA", "CCNA"
];

export default function CertifyPage() {
  const { t } = useI18n();
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("session");

  const certifyTopics = [
    { topic: t('certify.topic1'), category: t('certify.categoryCloud'), emoji: "☁️" },
    { topic: t('certify.topic2'), category: t('certify.categoryHardware'), emoji: "🔧" },
    { topic: t('certify.topic3'), category: t('certify.categoryManagement'), emoji: "📋" },
    { topic: t('certify.topic4'), category: t('certify.categoryCloud'), emoji: "📊" },
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
              <RoadmapBadge label={t('certify.mockupLabel')} eta={t('certify.mockupEta')} />
              <div className="bg-slate-700/50 px-5 py-2.5 border-b border-slate-700 flex items-center justify-between">
                <span className="text-sm font-medium text-slate-300">{t('certify.mockupTitle')}</span>
                <span className="text-xs text-slate-500">{t('certify.mockupSubtitle')}</span>
              </div>
              <div className="p-5 flex flex-col">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <div className="w-14 h-14 rounded-full border-4 border-slate-500 flex items-center justify-center">
                      <span className="text-lg font-bold text-slate-300">45%</span>
                    </div>
                    <div>
                      <p className="text-base font-medium text-white">{t('certify.inProgress')}</p>
                      <p className="text-xs text-slate-500">{t('certify.target')}: {t('certify.june2026')}</p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button className="text-xs bg-slate-600/50 hover:bg-slate-600 text-slate-300 px-3 py-1.5 rounded-lg transition-colors">
                      {t('certify.blueprint')}
                    </button>
                    <button className="text-xs bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg transition-colors">
                      {t('certify.schedule')}
                    </button>
                  </div>
                </div>
                
                <div className="relative my-4">
                  <div className="absolute top-4 left-0 right-0 h-0.5 bg-slate-700" />
                  <div className="absolute top-4 left-0 h-0.5 bg-slate-500" style={{ width: "45%" }} />
                  <div className="relative flex justify-between">
                    {[
                      { label: "Cloud Basics", status: "complete", icon: "✓" },
                      { label: "IAM & S3", status: "complete", icon: "✓" },
                      { label: "EC2", status: "current", icon: "●" },
                      { label: "Databases", status: "upcoming", icon: "○" },
                      { label: "Networking", status: "upcoming", icon: "○" },
                      { label: "Security", status: "upcoming", icon: "○" },
                    ].map(({ label, status, icon }) => (
                      <div key={label} className="flex flex-col items-center">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium mb-1.5 ${
                          status === "complete" ? "bg-slate-600 text-white" :
                          status === "current" ? "bg-slate-700 text-slate-300 border-2 border-slate-500" :
                          "bg-slate-800 text-slate-600 border border-slate-700"
                        }`}>
                          {icon}
                        </div>
                        <span className={`text-[9px] text-center ${
                          status === "complete" ? "text-slate-400" :
                          status === "current" ? "text-slate-300" :
                          "text-slate-600"
                        }`}>{label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3 mt-4 pt-4 border-t border-slate-700">
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-0.5">{t('certify.practiceScore')}</p>
                    <p className="text-lg font-bold text-white">72%</p>
                    <p className="text-[10px] text-emerald-400">{t('certify.thisWeek')}</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-0.5">{t('certify.weakAreas')}</p>
                    <p className="text-lg font-bold text-white">3</p>
                    <p className="text-[10px] text-rose-400">Multi-AZ</p>
                  </div>
                  <div>
                    <p className="text-[10px] text-slate-500 uppercase mb-0.5">{t('certify.streak')}</p>
                    <p className="text-lg font-bold text-white">12 {t('certify.days')}</p>
                    <p className="text-[10px] text-slate-500">{t('certify.keepItUp')}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Value Proposition - Updated to bullet format */}
            <div className="space-y-4">
              <h3 className="text-lg font-semibold text-white">{t('certify.problemTitle')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('certify.problem1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('certify.problem2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>{t('certify.problem3')}</span>
                </li>
              </ul>
              
              <h3 className="text-lg font-semibold text-white pt-4">{t('certify.howItHelps')}</h3>
              <ul className="space-y-2">
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('certify.solution1')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('certify.solution2')}</span>
                </li>
                <li className="flex items-start gap-2 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>{t('certify.solution3')}</span>
                </li>
              </ul>
            </div>

            {/* Certification Badges */}
            <div>
              <p className="text-sm text-slate-400 mb-3">{t('certify.worksForCert')}</p>
              <div className="flex flex-wrap gap-2">
                {CERTIFICATION_BADGES.map((badge) => (
                  <span 
                    key={badge} 
                    className="text-xs px-2.5 py-1 rounded-lg bg-slate-800 border border-slate-700 text-slate-300"
                  >
                    {badge}
                  </span>
                ))}
                <span className="text-xs px-2.5 py-1 rounded-lg bg-slate-800/50 border border-slate-700/50 text-slate-500">
                  {t('certify.moreBadges')}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-4">
          <div className="w-full flex flex-col">
            {/* Solution Label */}
            <div className="flex justify-center mb-4">
              <span className="text-xs text-slate-500 uppercase tracking-widest">{t('certify.label')}</span>
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
                  {t('certify.practiceNow')}
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                      : "text-slate-500 hover:text-white"
                  }`}
                >
                  {t('certify.buildRoadmap')}
                </button>
              </div>
            </div>

            {mode === "session" && (
              <div className="flex flex-col flex-1">
                <div className="text-center mb-5">
                  <h2 className="text-2xl sm:text-3xl font-bold text-white mb-2 tracking-tight">
                    {t('certify.title')}
                  </h2>
                  <p className="text-slate-500 max-w-md mx-auto text-sm leading-relaxed">
                    {t('certify.subtitle')}
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="slate" 
                    placeholder={t('certify.placeholder')}
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-slate-500 mb-3 text-center">
                    {t('certify.popularTopics')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {certifyTopics.map(({ topic, category, emoji }) => (
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
                  title={t('certify.buildRoadmap')}
                  subtitle={t('certify.buildRoadmapSubtitle')}
                  placeholder={t('certify.placeholder')}
                  exampleTopics={t('certify.buildRoadmapExamples').split(', ')}
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
