import { cn } from "@/lib/utils";
import {
  seededUnit,
  workspaceAbstractPalette,
  workspaceVisualSeed,
} from "@/lib/workspace-visual";

interface WorkspaceAbstractArtProps {
  seed: string;
  className?: string;
}

export function WorkspaceAbstractArt({ seed, className }: WorkspaceAbstractArtProps) {
  const hash = workspaceVisualSeed(seed);
  const unit = (slot: number) => seededUnit(hash, slot);
  const [primary, secondary, accent] = workspaceAbstractPalette(hash);
  const id = `ws-art-${hash.toString(36)}`;

  const orbA = {
    cx: 70 + unit(1) * 260,
    cy: 30 + unit(2) * 120,
    r: 48 + unit(3) * 56,
  };
  const orbB = {
    cx: 90 + unit(4) * 220,
    cy: 20 + unit(5) * 140,
    r: 36 + unit(6) * 48,
  };
  const orbC = {
    cx: 40 + unit(7) * 300,
    cy: 10 + unit(8) * 150,
    r: 28 + unit(9) * 40,
  };

  const arcStartX = 20 + unit(10) * 80;
  const arcEndX = 280 + unit(11) * 100;
  const arcY = 40 + unit(12) * 100;

  return (
    <svg
      viewBox="0 0 400 200"
      preserveAspectRatio="xMidYMid slice"
      className={cn("h-full w-full", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${id}-bg`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#09090b" />
          <stop offset="55%" stopColor="#111827" />
          <stop offset="100%" stopColor="#050505" />
        </linearGradient>
        <radialGradient id={`${id}-glow`} cx="50%" cy="40%" r="70%">
          <stop offset="0%" stopColor={primary} stopOpacity="0.22" />
          <stop offset="100%" stopColor={primary} stopOpacity="0" />
        </radialGradient>
        <filter id={`${id}-blur`} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="18" />
        </filter>
        <pattern id={`${id}-grid`} width="24" height="24" patternUnits="userSpaceOnUse">
          <path
            d="M24 0H0V24"
            fill="none"
            stroke="rgba(255,255,255,0.04)"
            strokeWidth="0.5"
          />
        </pattern>
      </defs>

      <rect width="400" height="200" fill={`url(#${id}-bg)`} />
      <rect width="400" height="200" fill={`url(#${id}-glow)`} />
      <rect width="400" height="200" fill={`url(#${id}-grid)`} />

      <g filter={`url(#${id}-blur)`} opacity="0.9">
        <circle cx={orbA.cx} cy={orbA.cy} r={orbA.r} fill={primary} opacity="0.42" />
        <circle cx={orbB.cx} cy={orbB.cy} r={orbB.r} fill={secondary} opacity="0.34" />
        <circle cx={orbC.cx} cy={orbC.cy} r={orbC.r} fill={accent} opacity="0.28" />
      </g>

      <path
        d={`M ${arcStartX} ${arcY} Q ${200 + unit(13) * 40} ${20 + unit(14) * 60}, ${arcEndX} ${arcY + 20 + unit(15) * 40}`}
        fill="none"
        stroke={secondary}
        strokeWidth="1.2"
        opacity="0.45"
      />
      <path
        d={`M ${30 + unit(16) * 50} ${150 + unit(17) * 20} C ${120 + unit(18) * 60} ${60 + unit(19) * 40}, ${240 + unit(20) * 40} ${140 + unit(21) * 30}, ${360 + unit(22) * 20} ${90 + unit(23) * 50}`}
        fill="none"
        stroke={accent}
        strokeWidth="0.8"
        opacity="0.35"
      />

      <circle cx={50 + unit(24) * 300} cy={24 + unit(25) * 40} r="2.5" fill={primary} opacity="0.7" />
      <circle cx={80 + unit(26) * 280} cy={150 + unit(27) * 30} r="1.8" fill={secondary} opacity="0.55" />
      <circle cx={300 + unit(28) * 70} cy={50 + unit(29) * 100} r="2.2" fill={accent} opacity="0.6" />
    </svg>
  );
}