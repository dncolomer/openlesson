"use client";

export interface MarkerRadarScore {
  id: string;
  label: string;
  score: number;
  rationale?: string;
}

interface MarkerRadarChartProps {
  markers: MarkerRadarScore[];
  className?: string;
  ariaLabel?: string;
  variant?: "default" | "large";
}

function truncateLabel(label: string, markerCount: number): string {
  const maxLength = markerCount > 7 ? 12 : markerCount > 5 ? 14 : 18;
  const trimmed = label.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, maxLength - 1)}…`;
}

export function MarkerRadarChart({
  markers,
  className = "mx-auto aspect-square h-auto w-full max-w-xs",
  ariaLabel = "Competency marker scores",
  variant = "default",
}: MarkerRadarChartProps) {
  if (!markers.length) return null;

  const isLarge = variant === "large";
  const markerCount = markers.length;
  const radius = isLarge
    ? markerCount > 7
      ? 92
      : markerCount > 5
        ? 104
        : 116
    : markerCount > 7
      ? 68
      : markerCount > 5
        ? 76
        : 84;
  const labelOffset = isLarge
    ? markerCount > 7
      ? 30
      : markerCount > 5
        ? 36
        : 42
    : markerCount > 7
      ? 22
      : markerCount > 5
        ? 28
        : 34;
  const padding = isLarge ? 96 : 78;
  const size = radius * 2 + padding * 2;
  const center = padding + radius;

  const points = markers.map((marker, index) => {
    const angle = -Math.PI / 2 + (index / markerCount) * Math.PI * 2;
    const score = Math.max(0, Math.min(100, Number(marker.score) || 0));
    const value = score / 100;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const displayLabel = truncateLabel(marker.label, markerCount);

    return {
      x: center + cos * radius * value,
      y: center + sin * radius * value,
      labelX: center + cos * (radius + labelOffset),
      labelY: center + sin * (radius + labelOffset),
      scoreX: center + cos * (radius * value + 10),
      scoreY: center + sin * (radius * value + 10),
      textAnchor: (Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end",
      score,
      displayLabel,
      marker,
    };
  });

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      preserveAspectRatio="xMidYMid meet"
      className={className}
      role="img"
      aria-label={ariaLabel}
    >
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <g key={level}>
          <polygon
            points={markers
              .map((_, index) => {
                const angle = -Math.PI / 2 + (index / markerCount) * Math.PI * 2;
                return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
          />
          <text
            x={center + 4}
            y={center - radius * level + (level === 1 ? -6 : 4)}
            className={`fill-neutral-500 font-mono ${isLarge ? "text-[11px]" : "text-[9px]"}`}
          >
            {Math.round(level * 100)}
          </text>
        </g>
      ))}
      {markers.map((_, index) => {
        const angle = -Math.PI / 2 + (index / markerCount) * Math.PI * 2;
        return (
          <line
            key={`axis-${index}`}
            x1={center}
            y1={center}
            x2={center + Math.cos(angle) * radius}
            y2={center + Math.sin(angle) * radius}
            stroke="rgba(255,255,255,0.08)"
          />
        );
      })}
      <polygon
        points={points.map((point) => `${point.x},${point.y}`).join(" ")}
        fill="rgba(255,255,255,0.16)"
        stroke="white"
        strokeWidth="2"
      />
      {points.map((point) => (
        <g key={point.marker.id}>
          <circle cx={point.x} cy={point.y} r="4" fill="white" />
          <text
            x={point.scoreX}
            y={point.scoreY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className={`fill-white font-mono font-medium ${isLarge ? "text-xs" : "text-[10px]"}`}
          >
            {point.score}
          </text>
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className={`fill-neutral-400 ${isLarge ? "text-[10px] sm:text-xs" : "text-[8px] sm:text-[9px]"}`}
          >
            {point.displayLabel}
            <title>{point.marker.label}</title>
          </text>
        </g>
      ))}
    </svg>
  );
}