import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPrompts } from "@/lib/user-prompts";
import { getLanguageName } from "@/lib/tutoring-languages";
import { generateStuckPolicyRecommendation } from "@/lib/xai";
import {
  getRecentScreenshots,
  getRecentToolEvents,
  getRecentTranscripts,
  getSession,
  getSessionPlan,
  logToolUsage,
} from "@/lib/storage";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      sessionId,
      lastStuckCardTimestamp = 0,
      stuckCardCount = 0,
      tutoringLanguage: bodyLanguage,
    } = body;

    if (!sessionId) {
      return NextResponse.json({ error: "Missing sessionId" }, { status: 400 });
    }

    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const [session, plan, promptOverrides, transcripts, toolEvents, screenshots] = await Promise.all([
      getSession(sessionId),
      getSessionPlan(sessionId, supabase),
      getUserPrompts(supabase, user.id),
      getRecentTranscripts(sessionId, 180000),
      getRecentToolEvents(sessionId, 180000),
      getRecentScreenshots(sessionId, 180000),
    ]);

    if (!session) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const currentStep = plan?.steps?.[plan.currentStepIndex]?.description || "";
    const now = Date.now();
    const secondsSinceLastStuckCard = lastStuckCardTimestamp
      ? Math.max(0, Math.floor((now - lastStuckCardTimestamp) / 1000))
      : 9999;

    const latestTranscriptAge = transcripts.length > 0
      ? Math.floor((now - transcripts[transcripts.length - 1].timestamp) / 1000)
      : null;
    const latestToolAge = toolEvents.length > 0
      ? Math.floor((now - toolEvents[toolEvents.length - 1].timestamp) / 1000)
      : null;

    const activitySummary = [
      `Recent transcript chunks: ${transcripts.length}`,
      `Recent transcript words: ${transcripts.reduce((sum, t) => sum + (t.wordCount || 0), 0)}`,
      `Seconds since latest transcript: ${latestTranscriptAge ?? "none"}`,
      `Recent tool events: ${toolEvents.length}`,
      `Seconds since latest tool event: ${latestToolAge ?? "none"}`,
      `Tool event sequence: ${toolEvents.slice(-12).map(e => `${e.toolName}/${e.toolAction}`).join(" -> ") || "none"}`,
      `Recent screenshots: ${screenshots.length}`,
      `Open probes: ${session.probes.filter(p => !p.archived).length}`,
    ].join("\n");

    const languageCode = bodyLanguage || session.metadata?.tutoringLanguage;
    const languageName = languageCode ? getLanguageName(languageCode) : undefined;

    const result = await generateStuckPolicyRecommendation({
      problem: session.problem,
      currentStep,
      activitySummary,
      transcript: "Transcript text is stored in recent transcript files; use activity timing and word counts to decide whether an intervention is warranted.",
      secondsSinceLastStuckCard,
      stuckCardCount,
      promptOverrides,
      tutoringLanguage: languageName,
    });

    if (!result.success || !result.result) {
      return NextResponse.json({ error: result.error || "Stuck policy failed" }, { status: 500 });
    }

    if (result.result.stuck) {
      await logToolUsage(sessionId, "chat", "stuck_card", now, {
        severity: result.result.severity,
        reason: result.result.reason,
        title: result.result.title,
      });
    }

    return NextResponse.json(result.result);
  } catch (error) {
    console.error("Stuck policy error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
