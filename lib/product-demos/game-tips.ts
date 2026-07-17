import { normalizePerformanceGapAnalysis } from "@/lib/agent-v2/performance-context";
import type { PerformanceReport } from "@/lib/agent-v2/performance-report";

export function isGameDemo(demo: { id: string; simulatorMode?: string }): boolean {
  return demo.simulatorMode === "game" || demo.id === "nexusfront";
}

export function isAppDemo(demo: { id: string; simulatorMode?: string }): boolean {
  return demo.simulatorMode === "app" || demo.id === "gridworks";
}

export function isExternalDemo(demo: { id: string; simulatorMode?: string }): boolean {
  return demo.simulatorMode === "external" || demo.id === "orbit";
}

export function isInteractiveDemo(demo: { id: string; simulatorMode?: string }): boolean {
  return isGameDemo(demo) || isAppDemo(demo) || isExternalDemo(demo);
}

export type GameCoaching = {
  directions: string[];
  events: string[];
  gapRepairs: string[];
};

export function extractGameCoaching(report: PerformanceReport | null): GameCoaching {
  if (!report) {
    return { directions: [], events: [], gapRepairs: [] };
  }

  const gapAnalysis = normalizePerformanceGapAnalysis(report.gap_analysis);
  const directions = [...gapAnalysis.next_steps.directions];
  const events = [...gapAnalysis.next_steps.events];
  const gapRepairs = gapAnalysis.gaps
    .map((gap) => gap.suggested_repair.trim())
    .filter(Boolean);

  if (directions.length === 0 && events.length === 0 && gapRepairs.length === 0) {
    const fallbacks = [...report.suggestions, ...report.growth_areas].map((item) => item.trim()).filter(Boolean);
    if (fallbacks.length > 0) {
      return { directions: [], events: fallbacks, gapRepairs: [] };
    }
  }

  return { directions, events, gapRepairs };
}
