"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bot, ChevronLeft, ChevronRight, User } from "lucide-react";
import { VERIFICATION_EXAMPLES, type VerificationAudience, type VerificationExample } from "@/lib/seo/verification-examples";

const ROTATE_MS = 7000;
const FADE_MS = 250;
const MANUAL_PAUSE_MS = 14000;

const AUDIENCE_STYLES: Record<
  VerificationAudience,
  { icon: typeof User; accent: string; productColor: string; dotActive: string }
> = {
  human: {
    icon: User,
    accent: "border-cyan-400/25 bg-cyan-950/30 text-cyan-200",
    productColor: "text-cyan-200/90",
    dotActive: "bg-cyan-300/80",
  },
  agent: {
    icon: Bot,
    accent: "border-violet-400/25 bg-violet-950/30 text-violet-200",
    productColor: "text-violet-200/90",
    dotActive: "bg-violet-300/80",
  },
};

function buildAlternatingExamples(examples: VerificationExample[]): VerificationExample[] {
  const humans = examples.filter((item) => item.audience === "human");
  const agents = examples.filter((item) => item.audience === "agent");
  const alternating: VerificationExample[] = [];
  const maxLen = Math.max(humans.length, agents.length);

  for (let i = 0; i < maxLen; i += 1) {
    if (humans[i]) alternating.push(humans[i]);
    if (agents[i]) alternating.push(agents[i]);
  }

  return alternating;
}

export function VerificationExamplesWidget() {
  const examples = useMemo(() => buildAlternatingExamples(VERIFICATION_EXAMPLES), []);
  const [index, setIndex] = useState(0);
  const [fading, setFading] = useState(false);
  const pauseUntilRef = useRef(0);

  const goTo = useCallback(
    (nextIndex: number, manual = false) => {
      if (examples.length === 0) return;
      const wrapped = ((nextIndex % examples.length) + examples.length) % examples.length;
      if (wrapped === index) return;

      if (manual) {
        pauseUntilRef.current = Date.now() + MANUAL_PAUSE_MS;
      }

      setFading(true);
      window.setTimeout(() => {
        setIndex(wrapped);
        setFading(false);
      }, FADE_MS);
    },
    [examples.length, index],
  );

  const goPrev = useCallback(() => goTo(index - 1, true), [goTo, index]);
  const goNext = useCallback(() => goTo(index + 1, true), [goTo, index]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (Date.now() < pauseUntilRef.current) return;
      goTo(index + 1);
    }, ROTATE_MS);

    return () => window.clearInterval(interval);
  }, [goTo, index]);

  const example = examples[index];
  if (!example) return null;

  const style = AUDIENCE_STYLES[example.audience];
  const AudienceIcon = style.icon;
  const topGap = example.gaps[0];

  return (
    <div className="relative border border-zinc-800/80 bg-zinc-950/75 p-4 shadow-2xl backdrop-blur-sm">
      <div
        className={`absolute -right-8 -top-8 h-28 w-28 rounded-full blur-3xl ${
          example.audience === "agent" ? "bg-violet-400/10" : "bg-cyan-400/10"
        }`}
      />
      <div className="rounded-2xl border border-neutral-800 bg-neutral-950/50 p-5">
        <div className="flex items-center justify-between gap-3 border-b border-neutral-800 pb-3">
          <div className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Learning verification</div>
          <span className={`inline-flex items-center gap-1.5 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1px] ${style.accent}`}>
            <AudienceIcon size={11} />
            {example.audience === "human" ? "Human" : "Agent"}
          </span>
        </div>

        <div className={`mt-4 transition-opacity duration-200 ${fading ? "opacity-0" : "opacity-100"}`} aria-live="polite">
          <p className={`font-mono text-[10px] uppercase tracking-[1.5px] ${style.productColor}`}>{example.product}</p>
          <p className="mt-2 text-lg font-medium leading-snug text-white">{example.title}</p>
          <p className="mt-2 text-sm leading-relaxed text-zinc-500">{example.context}</p>

          <div className="mt-3">
            <SpiderMetricsChart markers={example.markers} audience={example.audience} />
          </div>

          <div className="mt-2 flex items-baseline justify-center gap-3">
            <span className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-600">Readiness</span>
            <span className="text-2xl font-medium text-white">{example.score}</span>
          </div>

          {topGap && (
            <div className="mt-4 border-l-2 border-amber-400/40 pl-3">
              <p className="text-sm text-zinc-300">
                <span className="text-amber-200/90">{topGap.label}</span>
                <span className="text-zinc-600"> · </span>
                {topGap.detail}
              </p>
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={goPrev}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
            aria-label="Previous example"
          >
            <ChevronLeft size={16} />
          </button>

          <div className="flex flex-1 justify-center gap-1.5">
            {examples.map((item, dotIndex) => (
              <button
                key={item.id}
                type="button"
                onClick={() => goTo(dotIndex, true)}
                aria-label={`Show example ${dotIndex + 1}`}
                aria-current={dotIndex === index ? "true" : undefined}
                className={`h-1.5 rounded-full transition-all duration-200 ${
                  dotIndex === index ? `w-5 ${AUDIENCE_STYLES[item.audience].dotActive}` : "w-1.5 bg-zinc-700 hover:bg-zinc-500"
                }`}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={goNext}
            className="inline-flex size-8 shrink-0 items-center justify-center rounded-sm border border-zinc-800 text-zinc-400 transition hover:border-zinc-700 hover:text-white"
            aria-label="Next example"
          >
            <ChevronRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}

function SpiderMetricsChart({
  markers,
  audience,
}: {
  markers: { label: string; score: number }[];
  audience: VerificationAudience;
}) {
  const size = 240;
  const center = size / 2;
  const radius = 62;
  const isAgent = audience === "agent";
  const fill = isAgent ? "rgba(167,139,250,0.14)" : "rgba(34,211,238,0.12)";
  const stroke = isAgent ? "rgba(167,139,250,0.75)" : "rgba(34,211,238,0.7)";
  const pointHigh = isAgent ? "#c4b5fd" : "#67e8f9";

  const points = markers.map((marker, markerIndex) => {
    const angle = -Math.PI / 2 + (markerIndex / markers.length) * Math.PI * 2;
    const value = Math.max(0, Math.min(100, marker.score)) / 100;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center + cos * radius * value,
      y: center + sin * radius * value,
      labelX: center + cos * (radius + 24),
      labelY: center + sin * (radius + 24),
      textAnchor: (Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end",
      low: marker.score < 50,
      label: marker.label,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className="mx-auto w-full max-w-[240px]"
      role="img"
      aria-label="Skill metrics spider chart"
    >
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <polygon
          key={level}
          points={markers
            .map((_, markerIndex) => {
              const angle = -Math.PI / 2 + (markerIndex / markers.length) * Math.PI * 2;
              return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.1)"
        />
      ))}
      {markers.map((_, markerIndex) => {
        const angle = -Math.PI / 2 + (markerIndex / markers.length) * Math.PI * 2;
        return (
          <line
            key={`axis-${markerIndex}`}
            x1={center}
            y1={center}
            x2={center + Math.cos(angle) * radius}
            y2={center + Math.sin(angle) * radius}
            stroke="rgba(255,255,255,0.06)"
          />
        );
      })}
      <polygon
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill={fill}
        stroke={stroke}
        strokeWidth="1.5"
      />
      {points.map((point) => (
        <g key={point.label}>
          <circle cx={point.x} cy={point.y} r="3" fill={point.low ? "#fbbf24" : pointHigh} />
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className="fill-zinc-500 text-[7px]"
          >
            {point.label}
          </text>
        </g>
      ))}
    </svg>
  );
}