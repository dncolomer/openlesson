"use client";

import { useI18n } from "../lib/i18n";

interface Feature {
  name: string;
  description?: string;
}

interface ComingSoonFeature extends Feature {
  eta?: string;
}

interface FeatureStatusProps {
  available: Feature[];
  comingSoon: ComingSoonFeature[];
  title?: string;
}

export function FeatureStatus({ 
  available, 
  comingSoon,
  title 
}: FeatureStatusProps) {
  const { t } = useI18n();
  return (
    <div className="w-full">
      {title && (
        <h3 className="text-base font-semibold text-white mb-4">{title}</h3>
      )}
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Available Now */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span className="text-sm font-medium text-emerald-400">{t('featureStatus.availableNow')}</span>
          </div>
          <ul className="space-y-2">
            {available.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <svg 
                  className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M5 13l4 4L19 7" 
                  />
                </svg>
                <div>
                  <span className="text-sm text-slate-300">{feature.name}</span>
                  {feature.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{feature.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>

        {/* Coming Soon */}
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="w-2 h-2 rounded-full bg-white" />
            <span className="text-sm font-medium text-neutral-300">{t('featureStatus.comingSoon')}</span>
          </div>
          <ul className="space-y-2">
            {comingSoon.map((feature, index) => (
              <li key={index} className="flex items-start gap-2">
                <svg 
                  className="w-4 h-4 text-slate-600 shrink-0 mt-0.5" 
                  fill="none" 
                  viewBox="0 0 24 24" 
                  stroke="currentColor"
                >
                  <path 
                    strokeLinecap="round" 
                    strokeLinejoin="round" 
                    strokeWidth={2} 
                    d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
                  />
                </svg>
                <div>
                  <span className="text-sm text-slate-400">{feature.name}</span>
                  {feature.eta && (
                    <span className="text-xs text-slate-600 ml-2">({feature.eta})</span>
                  )}
                  {feature.description && (
                    <p className="text-xs text-slate-500 mt-0.5">{feature.description}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

// Roadmap badge component for mockups
interface RoadmapBadgeProps {
  label?: string;
  eta?: string;
}

export function RoadmapBadge({ 
  label = "Dashboard Preview", 
  eta = "Coming Soon" 
}: RoadmapBadgeProps) {
  return (
    <div className="absolute top-3 right-3 z-10">
      <span className="px-2.5 py-1 text-[10px] bg-slate-800/90 text-slate-400 rounded-full border border-slate-700 backdrop-blur-sm">
        {label} — {eta}
      </span>
    </div>
  );
}
