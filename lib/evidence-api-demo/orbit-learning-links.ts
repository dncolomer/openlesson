import { normalizeDemoSessionUrl, openDemoSessionUrl } from "./demo-session-url";
import { ORBIT_PERFORMANCE_STYLE_PROMPT } from "./orbit-performance-style";
import { ORBIT_TAP_MIN_SCORE } from "./orbit-ui-manifest";
import { readJsonResponse } from "@/lib/read-json-response";

export type OrbitTapGateStatus = {
  cleared: boolean;
  score: number | null;
  tapLinkUrl: string | null;
};

export async function createOrbitIleSession(
  planId: string,
  blockId?: string
): Promise<string> {
  const res = await fetch("/api/evidence-api-demo/ile-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, ...(blockId ? { blockId } : {}) }),
  });
  const data = await readJsonResponse<{ session_url?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Failed to create ILE session");
  }
  if (!data.session_url) {
    throw new Error("ILE session URL missing");
  }
  return normalizeDemoSessionUrl(data.session_url);
}

export async function createOrbitTapSession(
  planId: string,
  blockId?: string
): Promise<string> {
  const res = await fetch("/api/evidence-api-demo/tap-link", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ planId, ...(blockId ? { blockId } : {}) }),
  });
  const data = await readJsonResponse<{ private_url?: string; error?: string }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Failed to create TAP session");
  }
  if (!data.private_url) {
    throw new Error("TAP session URL missing");
  }
  return normalizeDemoSessionUrl(data.private_url);
}

export async function fetchOrbitTapGateStatus(
  planId: string,
  existingTapLinkUrl?: string | null
): Promise<OrbitTapGateStatus> {
  try {
    const res = await fetch(`/api/workspace-tap-score?planId=${encodeURIComponent(planId)}`, {
      credentials: "same-origin",
    });
    if (!res.ok) {
      return { cleared: false, score: null, tapLinkUrl: existingTapLinkUrl ?? null };
    }
    const data = await readJsonResponse<{
      tapSessions?: Array<{ status?: string; overall_score?: number | null }>;
    }>(res);
    const sessions = data.tapSessions ?? [];
    const completed = sessions.filter((session) => session.status === "completed");
    const bestScore = completed.reduce<number | null>((best, session) => {
      const score =
        typeof session.overall_score === "number" && !Number.isNaN(session.overall_score)
          ? Math.round(session.overall_score)
          : null;
      if (score === null) return best;
      return best === null ? score : Math.max(best, score);
    }, null);

    return {
      cleared: bestScore !== null && bestScore >= ORBIT_TAP_MIN_SCORE,
      score: bestScore,
      tapLinkUrl: existingTapLinkUrl ?? null,
    };
  } catch {
    return { cleared: false, score: null, tapLinkUrl: existingTapLinkUrl ?? null };
  }
}

export function openOrbitLearningUrl(url: string): void {
  openDemoSessionUrl(url);
}

export async function askOrbitPerformanceQuestion(
  planId: string,
  prompt: string,
  options?: { blockId?: string; orbitUiContext?: string; stylePrompt?: string }
): Promise<string> {
  const stylePrompt = options?.stylePrompt?.trim() || ORBIT_PERFORMANCE_STYLE_PROMPT;

  const res = await fetch("/api/evidence-api-demo/performance", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      planId,
      prompt,
      style_prompt: stylePrompt,
      ...(options?.blockId ? { block_id: options.blockId } : {}),
      ...(options?.orbitUiContext?.trim()
        ? { orbit_ui_context: options.orbitUiContext.trim() }
        : {}),
    }),
  });
  const data = await readJsonResponse<{
    mode?: string;
    response?: string;
    error?: string;
  }>(res);
  if (!res.ok) {
    throw new Error(data.error || "Performance chat failed");
  }
  if (!data.response?.trim()) {
    throw new Error("No answer returned from Evidence API chat mode");
  }
  return data.response.trim();
}