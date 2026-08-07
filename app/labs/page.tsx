"use client";

import { useState } from "react";
import Link from "next/link";
import { useI18n } from "@/lib/i18n";

interface LabTool {
  id: string;
  name: string;
  description: string;
  icon: string;
  href: string;
  badge?: string;
  badgeType?: "new" | "coming-soon";
  requiresHardware?: string;
}

export default function LabsPage() {
  const [hoveredTool, setHoveredTool] = useState<string | null>(null);
  const { t } = useI18n();

  const labTools: LabTool[] = [
    {
      id: "mastery",
      name: t('labs.masteryCheck'),
      description: t('labs.masteryCheckDesc'),
      icon: "🧠",
      href: "/labs/mastery",
      badge: t('labs.badgeNew'),
      badgeType: "new",
      requiresHardware: t('labs.requiresMuseAthena'),
    },
  ];

  return (
    <div className="max-w-4xl mx-auto px-6 py-12">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white mb-2">{t('labs.title')}</h1>
        <p className="text-slate-400">
          {t('labs.subtitle')}
        </p>
      </div>

      <div className="grid gap-4">
        {labTools.map((tool) => (
          <Link
            key={tool.id}
            href={tool.href}
            className={`block p-6 rounded-xl border transition-all duration-200 ${
              tool.badgeType === "coming-soon"
                ? "border-slate-800 bg-slate-900/30 opacity-60 hover:opacity-80"
                : "border-slate-700 bg-slate-800/30 hover:border-neutral-600/50 hover:bg-slate-800/50"
            }`}
            onMouseEnter={() => setHoveredTool(tool.id)}
            onMouseLeave={() => setHoveredTool(null)}
          >
            <div className="flex items-start justify-between">
              <div className="flex items-start gap-4">
                <span className="text-3xl">{tool.icon}</span>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-semibold text-white">{tool.name}</h3>
                    {tool.badge && (
                      <span
                        className={`px-2 py-0.5 text-xs rounded-full ${
                          tool.badgeType === "new"
                            ? "bg-neutral-800/20 text-neutral-300"
                            : "bg-slate-700 text-slate-400"
                        }`}
                      >
                        {tool.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-slate-400">{tool.description}</p>
                  {tool.requiresHardware && (
                    <p className="text-xs text-slate-500 mt-2">
                      {t('labs.requires')}: {tool.requiresHardware}
                    </p>
                  )}
                </div>
              </div>
              {tool.badgeType !== "coming-soon" && (
                <svg
                  className={`w-5 h-5 text-slate-500 transition-transform ${
                    hoveredTool === tool.id ? "translate-x-1 text-neutral-300" : ""
                  }`}
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              )}
            </div>
          </Link>
        ))}
      </div>

      <div className="mt-8 p-4 bg-slate-900/50 border border-slate-800 rounded-lg">
        <p className="text-xs text-slate-500">
          {t('labs.disclaimer')}
        </p>
      </div>
    </div>
  );
}