import { aestheticImageForId } from "@/lib/aesthetics";

export function workspaceVisualSeed(id: string): number {
  let hash = 0;
  for (let index = 0; index < id.length; index += 1) {
    hash = (hash * 31 + id.charCodeAt(index)) >>> 0;
  }
  return hash;
}

export function seededUnit(seed: number, slot: number): number {
  return ((seed * (slot + 1) * 9301 + 49297) % 233280) / 233280;
}

export function resolveWorkspaceCoverImage(workspaceId: string, coverImageUrl?: string | null): string {
  if (coverImageUrl?.trim()) return coverImageUrl.trim();
  return aestheticImageForId(workspaceId);
}

export const WORKSPACE_ABSTRACT_PALETTES: ReadonlyArray<readonly [string, string, string]> = [
  ["#22d3ee", "#a78bfa", "#fb923c"],
  ["#34d399", "#60a5fa", "#f472b6"],
  ["#fbbf24", "#818cf8", "#2dd4bf"],
  ["#f87171", "#38bdf8", "#c084fc"],
  ["#4ade80", "#f472b6", "#38bdf8"],
  ["#a3e635", "#22d3ee", "#e879f9"],
];

export function workspaceAbstractPalette(seed: number): readonly [string, string, string] {
  return WORKSPACE_ABSTRACT_PALETTES[seed % WORKSPACE_ABSTRACT_PALETTES.length];
}