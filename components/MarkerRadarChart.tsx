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

/** Soft-wrap full label into lines (never truncates or ellipsizes). */
function wrapLabelLines(label: string, maxCharsPerLine: number): string[] {
  const trimmed = label.trim();
  if (!trimmed) return [""];
  if (trimmed.length <= maxCharsPerLine) return [trimmed];

  const words = trimmed.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [trimmed];

  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    // Single overlong word: keep whole word (do not trim mid-token).
    if (!current) {
      current = word;
      continue;
    }
    if (`${current} ${word}`.length <= maxCharsPerLine) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [trimmed];
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
      ? 34
      : markerCount > 5
        ? 40
        : 46
    : markerCount > 7
      ? 26
      : markerCount > 5
        ? 32
        : 38;
  // Prefer shorter wrap width when many markers so rings stay readable; still full text.
  const maxCharsPerLine =
    markerCount > 7 ? 16 : markerCount > 5 ? 20 : isLarge ? 28 : 22;
  const labelLineHeight = isLarge ? 12 : 10;
  const longestLabel = markers.reduce(
    (max, m) => Math.max(max, (m.label || "").trim().length),
    0,
  );
  const maxLines = Math.max(
    1,
    ...markers.map((m) => wrapLabelLines(m.label || "", maxCharsPerLine).length),
  );
  // Expand viewBox so full multi-line vertex labels are not clipped.
  const charPad = isLarge ? 5.2 : 4.4;
  const padding = Math.max(
    isLarge ? 96 : 78,
    48 + Math.min(longestLabel, maxCharsPerLine) * charPad + (maxLines - 1) * labelLineHeight,
  );
  const size = radius * 2 + padding * 2;
  const center = padding + radius;

  const points = markers.map((marker, index) => {
    const angle = -Math.PI / 2 + (index / markerCount) * Math.PI * 2;
    const score = Math.max(0, Math.min(100, Number(marker.score) || 0));
    const value = score / 100;
    const cos = Math.cos(angle);
    const sin = Math.sin(angle);
    const labelLines = wrapLabelLines(marker.label || "", maxCharsPerLine);
    // Stack multi-line labels around the radial anchor so they stay near the vertex.
    const labelBlockOffset = ((labelLines.length - 1) * labelLineHeight) / 2;

    return {
      x: center + cos * radius * value,
      y: center + sin * radius * value,
      labelX: center + cos * (radius + labelOffset),
      labelY: center + sin * (radius + labelOffset) - labelBlockOffset,
      scoreX: center + cos * (radius * value + 10),
      scoreY: center + sin * (radius * value + 10),
      textAnchor: (Math.abs(cos) < 0.2 ? "middle" : cos > 0 ? "start" : "end") as "middle" | "start" | "end",
      score,
      labelLines,
      fullLabel: (marker.label || "").trim(),
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
            data-marker-label={point.marker.id}
          >
            <title>{point.fullLabel}</title>
            {point.labelLines.map((line, lineIndex) => (
              <tspan
                key={`${point.marker.id}-line-${lineIndex}`}
                x={point.labelX}
                dy={lineIndex === 0 ? 0 : labelLineHeight}
              >
                {line}
              </tspan>
            ))}
          </text>
        </g>
      ))}
    </svg>
  );
}