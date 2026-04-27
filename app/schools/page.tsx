"use client";

import { useState } from "react";
import { ProblemInput } from "@/components/ProblemInput";
import { PlanModeSelect } from "@/components/PlanModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SolutionsBand } from "@/components/SolutionsBand";
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

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-2">
        {/* Left Column - Scrollable content */}
        <div className="order-2 lg:order-1 bg-[#0a0a0a] lg:border-r border-t lg:border-t-0 border-slate-800 lg:h-[calc(100vh-113px)] lg:overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 lg:py-8">
          <div className="w-full flex flex-col gap-8">
            {/* Hero Section */}
            <div>
              <h2 className="text-2xl font-bold text-white mb-3">Transform Your Classroom</h2>
              <p className="text-slate-400 leading-relaxed">
                Give every student personalized attention without stretching yourself thin. OpenLesson acts as a tireless teaching assistant that adapts to each student&apos;s needs while keeping you in full control.
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
                  <span>Large class sizes make individual attention nearly impossible</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Students fall behind and gaps go unnoticed until it&apos;s too late</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-red-400 mt-0.5">✗</span>
                  <span>Limited resources for differentiated instruction and remediation</span>
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
                  <span>AI-powered tutoring that gives every student one-on-one attention</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Real-time dashboard showing student progress and knowledge gaps</span>
                </li>
                <li className="flex items-start gap-3 text-sm text-slate-400">
                  <span className="text-emerald-400 mt-0.5">✓</span>
                  <span>Integrates with Google Classroom, Canvas, and other LMS platforms</span>
                </li>
              </ul>
            </div>

            {/* Analytics Highlight */}
            <div className="rounded-2xl border border-slate-800 bg-gradient-to-br from-slate-800/50 to-slate-900/50 p-6">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <svg className="w-6 h-6 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
                  </svg>
                </div>
                <div>
                  <h4 className="text-white font-semibold mb-2">Performance Analytics</h4>
                  <p className="text-sm text-slate-400 leading-relaxed">
                    OpenLesson gives you and your school the power to dive into individual and collective performance analytics. Monitor class-wide trends, identify struggling students early, and demonstrate learning outcomes to administrators.
                  </p>
                </div>
              </div>
            </div>

          </div>
        </div>

        {/* Right Column - Sticky at top (shows on top on mobile) */}
        <div className="order-1 lg:order-2 lg:sticky lg:top-[113px] lg:h-[calc(100vh-113px)] flex items-center justify-center px-4 sm:px-6 lg:px-8 py-6 lg:py-4 relative overflow-hidden">
          {/* Background image with blur */}
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: "url('/school.jpg')" }}
          />
          <div className="absolute inset-0 backdrop-blur-sm bg-[#0a0a0a]/60" />
          
          <div className="w-full flex flex-col relative z-10">
            {/* Label */}
            <div className="flex justify-center mb-3">
              <span className="text-xs font-medium text-white/70 uppercase tracking-wider">{t('schools.label')}</span>
            </div>
            
            {/* Mode Toggle */}
            <div className="flex justify-center mb-5">
              <div className="bg-white/10 backdrop-blur-sm rounded-xl p-1 flex gap-1 border border-white/20">
                <button
                  onClick={() => setMode("session")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "session"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10"
                  }`}
                >
                  {t('schools.assignTopic')}
                </button>
                <button
                  onClick={() => setMode("plan")}
                  className={`px-5 py-2 text-sm font-medium rounded-lg transition-all ${
                    mode === "plan"
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-white/70 hover:text-white hover:bg-white/10"
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
                  <p className="text-white/70 max-w-md mx-auto text-sm leading-relaxed">
                    {t('schools.subtitle')}
                  </p>
                </div>

                <div className="w-full max-w-lg mx-auto">
                  <ProblemInput 
                    initialTopic={selectedTopic} 
                    theme="glass" 
                    placeholder={t('schools.placeholder')}
                  />
                </div>

                <div className="mt-6 flex-1 flex flex-col">
                  <p className="text-sm text-white/70 mb-3 text-center">
                    {t('schools.commonTopics')}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 flex-1">
                    {schoolsTopics.map(({ topic, category, emoji }) => (
                      <button
                        key={topic}
                        onClick={() => setSelectedTopic(topic)}
                        className="text-left p-3 rounded-xl border border-white/20 bg-white/10 hover:bg-white/20 hover:border-white/30 transition-all duration-200"
                      >
                        <p className="text-[13px] text-white leading-snug mb-1.5">
                          {topic}
                        </p>
                        <div className="flex items-center gap-1.5">
                          <span className="text-xs">{emoji}</span>
                          <span className="text-[11px] text-white/60">{category}</span>
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
                  theme="glass"
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
