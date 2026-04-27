"use client";

import { useState } from "react";
import { HumanModeSelect } from "@/components/HumanModeSelect";
import { TopicBrowser } from "@/components/TopicBrowser";
import { Footer } from "@/components/Footer";
import { Navbar } from "@/components/Navbar";
import { SolutionsBand } from "@/components/SolutionsBand";
import { DemoBanner } from "@/components/DemoBanner";
import { useI18n } from "@/lib/i18n";

export default function Home() {
  const [selectedTopic, setSelectedTopic] = useState("");
  const { t } = useI18n();

  return (
    <main className="min-h-screen flex flex-col bg-[#0a0a0a]">
      <DemoBanner />
      <Navbar />
      <SolutionsBand />

      <div className="flex-1 w-full px-4 sm:px-6 py-6 sm:py-8">
        <div className="w-full">
          <div className="grid grid-cols-1 lg:grid-cols-[60%_40%] gap-6 lg:gap-8 items-stretch">
            {/* Left column — full-height video */}
            <div className="order-2 lg:order-1 min-h-[380px] lg:min-h-[640px] flex rounded-2xl overflow-hidden">
              <video
                src="/video_lp.mp4"
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />
            </div>

            {/* Right column — content */}
            <div className="order-1 lg:order-2 flex flex-col lg:pr-8">
              <div className="mb-5">
                <h1 className="text-2xl sm:text-xl md:text-2xl lg:text-[22px] xl:text-2xl 2xl:text-3xl font-bold text-white tracking-tight leading-tight text-center">
                  {t("home.heroTitle")}
                </h1>
              </div>

              <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
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
              </div>
            </div>
          </div>
        </div>
      </div>

      <Footer />
    </main>
  );
}
