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
            className={`block border p-6 transition-colors ${
              tool.badgeType === "coming-soon"
                ? "border-white/20 bg-black text-white/60"
                : "border-white/30 bg-black hover:border-white/60"
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
                        className={`border border-white/30 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] ${
                          tool.badgeType === "new"
                            ? "bg-black text-white"
                            : "bg-black text-neutral-400"
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

      <div className="mt-8 border border-white/30 bg-black p-4">
        <p className="text-xs text-slate-500">
          {t('labs.disclaimer')}
        </p>
      </div>
    </div>
  );
}