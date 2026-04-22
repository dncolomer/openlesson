"use client";

import { useState } from "react";
import { HumanModeSelect } from "@/components/HumanModeSelect";
import { TopicBrowser } from "@/components/TopicBrowser";
import { CommunityPlansCarousel } from "@/components/CommunityPlansCarousel";
import { AgenticModeSelect } from "@/components/AgenticModeSelect";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { DemoBanner } from "@/components/DemoBanner";
import { useI18n } from "@/lib/i18n";

type Mode = "human" | "agentic";

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const [mode, setMode] = useState<Mode>("human");
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />

      {/* Full-screen split hero — left carousel, right tabbed pane.
          Both tabs (Human & Agentic) share the same left banner; only
          the right column swaps content based on the selected mode.
          The split fills the full viewport width edge-to-edge. */}
      <div className="flex-1 w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8 items-stretch">
            {/* Left column — full-height cinematic carousel */}
            <div className="order-2 lg:order-1 min-h-[380px] lg:min-h-[640px] flex">
              <CommunityPlansCarousel fillHeight />
            </div>

            {/* Right column — tabbed pane with mode toggle + content */}
            <div className="order-1 lg:order-2 flex flex-col">
              {/* Shared header: title + subtitle apply to both tabs.
                  Centered so the heading anchors the whole right column. */}
              <div className="mb-5 text-center">
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-white tracking-tight leading-tight mb-2">
                  {t("home.heroTitle")}
                </h1>
                <p className="text-slate-400 text-sm leading-relaxed max-w-xl mx-auto">
                  {t("home.heroSubtitle")}
                </p>
              </div>

              {/* Mode toggle lives INSIDE the right pane so the left
                  carousel stays the same across tabs. Centered to match
                  the heading above. */}
              <div className="mb-5 flex justify-center">
                <div className="inline-flex bg-slate-900/80 rounded-xl p-1 gap-1 border border-slate-800">
                  <button
                    onClick={() => setMode("human")}
                    className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      mode === "human"
                        ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {t("home.human")}
                  </button>
                  <button
                    onClick={() => setMode("agentic")}
                    className={`px-5 py-1.5 text-sm font-medium rounded-lg transition-all ${
                      mode === "agentic"
                        ? "bg-slate-700/50 text-slate-200 shadow-sm border border-slate-600"
                        : "text-slate-500 hover:text-white"
                    }`}
                  >
                    {t("home.agentic")}
                  </button>
                </div>
              </div>

              {/* Tab content — overflow-y-auto so long content scrolls
                  within the column instead of pushing the banner down. */}
              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
                {mode === "human" && (
                  <div className="space-y-6">
                    <HumanModeSelect initialTopic={selectedTopic} compact />
                    {/* Inline compact topic browser */}
                    <div className="rounded-2xl border border-slate-800/60 bg-slate-900/30 p-4">
                      <TopicBrowser
                        onSelectTopic={setSelectedTopic}
                        fullWidth
                        compact
                      />
                    </div>
                  </div>
                )}
                {mode === "agentic" && (
                  <div className="-mt-2">
                    <AgenticModeSelect />
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
