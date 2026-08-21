"use client";

import { useState } from "react";
import { useI18n } from "@/lib/i18n";

export interface BandPowers {
  delta: number;
  theta: number;
  alpha: number;
  beta: number;
  gamma: number;
}

interface BrainStateBarProps {
  powers: BandPowers | null;
  isConnected: boolean;
}

export function BrainStateBar({ powers, isConnected }: BrainStateBarProps) {
  const { t } = useI18n();
  const [showTooltip, setShowTooltip] = useState(false);

  if (!isConnected || !powers) return null;

  const total = powers.delta + powers.theta + powers.alpha + powers.beta + powers.gamma;
  if (total === 0) return null;

  const bands = [
    { name: "θ", value: powers.theta, color: "bg-neutral-800/70" },
    { name: "α", value: powers.alpha, color: "bg-neutral-800/70" },
    { name: "β", value: powers.beta, color: "bg-green-500/70" },
    { name: "γ", value: powers.gamma, color: "bg-neutral-800/70" },
  ];

  // Focus score: alpha/beta ratio (higher alpha relative to beta = more relaxed focus)
  const focusScore = powers.beta > 0 ? Math.round((powers.alpha / powers.beta) * 100) / 100 : 0;

  return (
    <div
      className="relative h-6 flex items-center gap-1"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {/* Band power segments */}
      <div className="flex-1 flex h-3 rounded-full overflow-hidden bg-neutral-800">
        {bands.map((band) => (
          <div
            key={band.name}
            className={`${band.color} transition-all duration-500`}
            style={{ width: `${(band.value / total) * 100}%` }}
          />
        ))}
      </div>

      {/* Focus score */}
      <span className="text-xs text-neutral-500 font-mono w-8 text-right">
        {focusScore.toFixed(1)}
      </span>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute bottom-full left-0 mb-2 bg-neutral-800 border border-neutral-700 rounded-none p-3 text-xs z-20 w-48">
          <div className="space-y-1">
            <div className="flex justify-between">
              <span className="text-neutral-300">{t('brainState.theta')}</span>
              <span className="text-neutral-300">{(powers.theta * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-300">{t('brainState.alpha')}</span>
              <span className="text-neutral-300">{(powers.alpha * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-green-400">{t('brainState.beta')}</span>
              <span className="text-neutral-300">{(powers.beta * 100).toFixed(0)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-neutral-300">{t('brainState.gamma')}</span>
              <span className="text-neutral-300">{(powers.gamma * 100).toFixed(0)}%</span>
            </div>
            <div className="pt-1 border-t border-neutral-700 flex justify-between">
              <span className="text-neutral-400">{t('brainState.focus')}</span>
              <span className="text-neutral-300">{focusScore.toFixed(2)}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
