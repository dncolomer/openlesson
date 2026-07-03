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
}

export function MarkerRadarChart({
  markers,
  className = "mx-auto size-full max-w-md overflow-visible",
  ariaLabel = "Competency marker scores",
}: MarkerRadarChartProps) {
  if (!markers.length) return null;

  const size = 360;
  const center = size / 2;
  const radius = 100;
  const points = markers.map((marker, index) => {
    const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
    const score = Math.max(0, Math.min(100, Number(marker.score) || 0));
    const value = score / 100;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    return {
      x: center + cos * radius * value,
      y: center + sin * radius * value,
      labelX: center + cos * (radius + 42),
      labelY: center + sin * (radius + 42),
      scoreX: center + cos * (radius * value + 14),
      scoreY: center + sin * (radius * value + 14),
      textAnchor: (Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end",
      score,
      marker,
    };
  });

  return (
    <svg viewBox={`0 0 ${size} ${size}`} className={className} role="img" aria-label={ariaLabel}>
      {[0.25, 0.5, 0.75, 1].map((level) => (
        <g key={level}>
          <polygon
            points={markers
              .map((_, index) => {
                const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
                return `${center + Math.cos(angle) * radius * level},${center + Math.sin(angle) * radius * level}`;
              })
              .join(" ")}
            fill="none"
            stroke="rgba(255,255,255,0.12)"
          />
          <text
            x={center + 4}
            y={center - radius * level + (level === 1 ? -6 : 4)}
            className="fill-neutral-500 text-[9px] font-mono"
          >
            {Math.round(level * 100)}
          </text>
        </g>
      ))}
      {markers.map((_, index) => {
        const angle = -Math.PI / 2 + (index / markers.length) * Math.PI * 2;
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
            className="fill-white text-[10px] font-mono font-medium"
          >
            {point.score}
          </text>
          <text
            x={point.labelX}
            y={point.labelY}
            textAnchor={point.textAnchor}
            dominantBaseline="middle"
            className="fill-neutral-400 text-[9px]"
          >
            {point.marker.label}
          </text>
        </g>
      ))}
    </svg>
  );
}