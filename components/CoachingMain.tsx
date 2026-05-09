"use client";

import Link from "next/link";
import { FAQ } from "@/components/FAQ";
import { useI18n } from "@/lib/i18n";

const VIDEO_IDS = [
  { id: "BC7HCkjtOME", titleKey: "coaching.videoTitle1", descKey: "coaching.videoDesc1" },
  { id: "I5nBTsHNnlI", titleKey: "coaching.videoTitle2", descKey: "coaching.videoDesc2" },
  { id: "SlvrIxbqMqA", titleKey: "coaching.videoTitle3", descKey: "coaching.videoDesc3" },
];

const APPROACH = [
  {
    icon: "🧠",
    title: "coaching.thinkDontMemorize",
    description: "coaching.thinkDontMemorizeDesc",
  },
  {
    icon: "🔍",
    title: "coaching.findStuckPoints",
    description: "coaching.findStuckPointsDesc",
  },
  {
    icon: "⚡",
    title: "coaching.buildIntuition",
    description: "coaching.buildIntuitionDesc",
  },
  {
    icon: "🎯",
    title: "coaching.systematicApproach",
    description: "coaching.systematicApproachDesc",
  },
];

const WHAT_YOULL_GET = [
  {
    icon: "🎯",
    title: "coaching.systematicProcess",
    description: "coaching.systematicProcessDesc",
  },
  {
    icon: "🔍",
    title: "coaching.blindSpots",
    description: "coaching.blindSpotsDesc",
  },
  {
    icon: "💡",
    title: "coaching.mentalModels",
    description: "coaching.mentalModelsDesc",
  },
  {
    icon: "📋",
    title: "coaching.personalizedStrategies",
    description: "coaching.personalizedStrategiesDesc",
  },
];

export function CoachingMain() {
  const { t } = useI18n();

  const COACHING_FAQ_ITEMS = [
    {
      question: t('coaching.faqTopicsQuestion'),
      answer: t('coaching.faqTopicsAnswer'),
    },
    {
      question: t('coaching.faqPrepareQuestion'),
      answer: t('coaching.faqPrepareAnswer'),
    },
    {
      question: t('coaching.faqFollowUpQuestion'),
      answer: t('coaching.faqFollowUpAnswer'),
    },
    {
      question: t('coaching.faqLevelQuestion'),
      answer: t('coaching.faqLevelAnswer'),
    },
    {
      question: t('coaching.faqOpenlessonQuestion'),
      answer: t('coaching.faqOpenlessonAnswer'),
    },
  ];

  return (
    <div className="flex-1 max-w-6xl mx-auto w-full px-4 sm:px-6 py-8 sm:py-12">
      {/* Hero */}
      <div className="text-center mb-16">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs mb-6">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
          {t('coaching.oneOnOne')}
        </div>
        <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-white mb-5 tracking-tight">
          {t('coaching.unlockMind')}
        </h1>
        <p className="text-slate-400 text-lg sm:text-xl max-w-2xl mx-auto leading-relaxed">
          {t('coaching.subtitle')}
        </p>
      </div>

      {/* Two Column Layout: Offer + Approach */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-16">
        {/* Coaching Offer */}
        <div className="rounded-2xl border border-amber-500/30 bg-gradient-to-b from-amber-950/30 to-slate-900/50 p-6 sm:p-8 relative order-2 lg:order-1">
          <div className="absolute -top-3 left-6 px-3 py-0.5 bg-amber-500 text-black text-[11px] font-medium rounded-full">
            {t('coaching.coachingSession')}
          </div>

          <div className="mb-6 pt-2">
            <div className="flex items-baseline gap-2 mb-1">
              <span className="text-5xl font-bold text-white">$199</span>
              <span className="text-slate-500 text-sm">{t('coaching.oneTime')}</span>
            </div>
            <p className="text-sm text-slate-500">{t('coaching.videoCall')}</p>
          </div>

          <ul className="space-y-3 mb-8">
            {[
              t('coaching.bullet1'),
              t('coaching.bullet2'),
              t('coaching.bullet3'),
              t('coaching.bullet4'),
              t('coaching.bullet5'),
              t('coaching.bullet6'),
            ].map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-sm text-slate-300">
                <svg className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>{item}</span>
              </li>
            ))}
          </ul>

          {/* Cal.com booking - placeholder link */}
          <a
            href="https://cal.com/daniel-colomer-lvwg8w/coaching"
            target="_blank"
            rel="noopener noreferrer"
            className="w-full py-3.5 text-center text-sm font-medium text-black bg-amber-500 hover:bg-amber-400 rounded-xl transition-colors flex items-center justify-center gap-2 mb-3"
          >
            <CalendarIcon />
            {t('coaching.bookSession')}
          </a>
          <p className="text-[11px] text-slate-600 text-center">
            {t('coaching.orDM').replace('@uncertainsys', '@uncertainsys')}
          </p>
        </div>

        {/* Approach Cards */}
        <div className="order-1 lg:order-2">
          <h2 className="text-lg font-semibold text-white mb-4">{t('coaching.theApproach')}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {APPROACH.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-xl border border-slate-800 bg-slate-900/50"
              >
                <span className="text-2xl mb-2 block">{item.icon}</span>
                <h3 className="text-sm font-medium text-white mb-1">{t(item.title)}</h3>
                <p className="text-xs text-slate-500 leading-relaxed">{t(item.description)}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* What You'll Get Section */}
      <div className="mb-16">
        <h2 className="text-xl sm:text-2xl font-semibold text-white text-center mb-3">
          {t('coaching.whatYoullGet')}
        </h2>
        <p className="text-slate-500 text-center text-sm mb-8 max-w-lg mx-auto">
          {t('coaching.whatYoullGetSubtitle')}
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {WHAT_YOULL_GET.map((item, index) => (
            <div
              key={index}
              className="rounded-xl border border-slate-800 bg-slate-900/50 p-5 text-center"
            >
              <span className="text-3xl mb-3 block">{item.icon}</span>
              <h3 className="text-sm font-medium text-white mb-2">{t(item.title)}</h3>
              <p className="text-xs text-slate-500 leading-relaxed">{t(item.description)}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Live Streams Section */}
      <div className="mb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold text-white mb-1">{t('coaching.liveSince')}</h2>
            <p className="text-sm text-slate-500">
              {t('coaching.realTimeThinking')}
            </p>
          </div>
          <a
            href="https://www.youtube.com/@UncertainSystems"
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm hover:bg-red-500/20 transition-colors"
          >
            <YoutubeIcon />
            {t('coaching.subscribe')}
          </a>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {VIDEO_IDS.map((video) => (
            <div
              key={video.id}
              className="rounded-xl border border-slate-800 bg-slate-900/50 overflow-hidden group hover:border-slate-700 transition-colors"
            >
              <div className="aspect-video">
                <iframe
                  src={`https://www.youtube.com/embed/${video.id}`}
                  title={t(video.titleKey)}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  className="w-full h-full"
                />
              </div>
              <div className="p-4">
                <h3 className="text-sm font-medium text-slate-200 mb-1 group-hover:text-white transition-colors">{t(video.titleKey)}</h3>
                <p className="text-xs text-slate-600 leading-relaxed">{t(video.descKey)}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-4 text-center sm:hidden">
          <a
            href="https://www.youtube.com/@UncertainSystems"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-red-400 hover:text-red-300 transition-colors"
          >
            <YoutubeIcon />
            {t('coaching.watchOnYouTube')}
            <span className="text-slate-700">&rarr;</span>
          </a>
        </div>
      </div>

      {/* FAQ Section */}
      <div className="mb-16">
        <FAQ items={COACHING_FAQ_ITEMS} title={t('coaching.faqTitle')} />
      </div>

      {/* Testimonial / Quote */}
      <div className="max-w-2xl mx-auto text-center mb-16">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/30 p-8">
          <svg className="w-8 h-8 text-slate-700 mx-auto mb-4" fill="currentColor" viewBox="0 0 24 24">
            <path d="M14.017 21v-7.391c0-5.704 3.731-9.57 8.983-10.609l.995 2.151c-2.432.917-3.995 3.638-3.995 5.849h4v10h-9.983zm-14.017 0v-7.391c0-5.704 3.748-9.57 9-10.609l.996 2.151c-2.433.917-3.996 3.638-3.996 5.849h3.983v10h-9.983z" />
          </svg>
          <p className="text-lg text-slate-300 italic mb-4">
            {t('coaching.philosophyQuote')}
          </p>
          <p className="text-sm text-slate-500">{t('coaching.philosophySource')}</p>
        </div>
      </div>

      {/* CTA */}
      <div className="text-center">
        <a
          href="https://cal.com/daniel-colomer-lvwg8w/coaching"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-6 py-3 bg-white hover:bg-slate-200 text-black text-sm font-medium rounded-xl transition-colors"
        >
          <CalendarIcon />
          {t('coaching.bookYourSession')}
        </a>
        <p className="text-xs text-slate-600 mt-3">
          {t('coaching.limitedAvailability')} — {t('coaching.orDM')}
        </p>
      </div>
    </div>
  );
}

function YoutubeIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
      <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
    </svg>
  );
}

function CalendarIcon() {
  return (
    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
      <line x1="16" x2="16" y1="2" y2="6" />
      <line x1="8" x2="8" y1="2" y2="6" />
      <line x1="3" x2="21" y1="10" y2="10" />
    </svg>
  );
}
