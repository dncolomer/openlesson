import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserPrompts } from "@/lib/user-prompts";
import { getLanguageName } from "@/lib/tutoring-languages";
import { generateStuckPolicyRecommendation } from "@/lib/xai";
import {
  getRecentScreenshots,
  getRecentToolEvents,
  getRecentTranscripts,
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

    const [sessionResult, probesResult, plan, promptOverrides, transcripts, toolEvents, screenshots] = await Promise.all([
      supabase
        .from("sessions")
        .select("id, problem, metadata")
        .eq("id", sessionId)
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("probes")
        .select("archived")
        .eq("session_id", sessionId),
      getSessionPlan(sessionId, supabase),
      getUserPrompts(supabase, user.id),
      getRecentTranscripts(sessionId, 180000),
      getRecentToolEvents(sessionId, 180000),
      getRecentScreenshots(sessionId, 180000),
    ]);

    const session = sessionResult.data;
    if (!session) {
      return NextResponse.json({
        stuck: false,
        severity: "low",
        title: "",
        recommendationMarkdown: "",
        reason: "Session context unavailable for stuck policy evaluation",
      });
    }

    const probes = probesResult.data || [];

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
      `Open probes: ${probes.filter(p => !p.archived).length}`,
    ].join("\n");

    const sessionFileIds = [
      ...transcripts.slice(-10).map(t => t.xaiFileId),
      ...toolEvents.slice(-10).map(t => t.xaiFileId),
      ...screenshots.slice(-3).map(s => s.xaiFileId),
    ].filter((id): id is string => !!id && id !== "_empty");

    const metadata = session.metadata as { tutoringLanguage?: string } | null;
    const languageCode = bodyLanguage || metadata?.tutoringLanguage;
    const languageName = languageCode ? getLanguageName(languageCode) : undefined;

    const result = await generateStuckPolicyRecommendation({
      problem: session.problem,
      currentStep,
      activitySummary,
      transcript: sessionFileIds.length > 0
        ? "Use the attached transcript files via xAI attachment search."
        : "No recent transcript files are available; use activity timing and word counts to decide whether an intervention is warranted.",
      secondsSinceLastStuckCard,
      stuckCardCount,
      sessionFileIds,
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
