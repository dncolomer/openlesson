import { NextRequest, NextResponse } from "next/server";
import { callXaiJSON, DEFAULT_MODEL, systemMessage, userMessage } from "@/lib/xai-client";
import { createClient } from "@/lib/supabase/server";
import { getUserTimezone, localDayKey, scoreRabbitHole } from "@/lib/rabbit-hole";

type Interview = { question: string; choices: string[]; correctIndex: number; rationale: string };

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const body = await request.json();
  const path = Array.isArray(body.path) ? body.path : [];
  const timezone = getUserTimezone(body.timezone);
  const localDay = localDayKey(timezone);
  const topQuestionId = typeof body.topQuestionId === "string" ? body.topQuestionId : null;

  const { data: existingPlays } = await supabase.from("rabbit_hole_plays").select("id").eq("user_id", user.id).eq("local_day", localDay).not("completed_at", "is", null);
  const { data: profile } = await supabase.from("profiles").select("is_admin, rabbit_hole_bonus_plays").eq("id", user.id).single();
  const isAdmin = profile?.is_admin ?? false;
  const mustUseBonus = !isAdmin && (existingPlays?.length ?? 0) > 0;
  const bonusPlays = profile?.rabbit_hole_bonus_plays ?? 0;
  if (mustUseBonus && bonusPlays <= 0) return NextResponse.json({ error: "Out of plays today" }, { status: 402 });

  const result = await callXaiJSON<Interview>([
    systemMessage("Generate exactly one calm, personal, 3-choice multiple-choice question based only on the user's Rabbit Hole question path. Return JSON with question, choices, correctIndex, rationale. choices must contain exactly 3 strings. correctIndex must be 0, 1, or 2."),
    userMessage(JSON.stringify({ path }, null, 2)),
  ], { model: DEFAULT_MODEL, maxTokens: 500, temperature: 0.2 });

  if (!result.success || !result.data || result.data.choices?.length !== 3) return NextResponse.json({ error: "Failed to generate interview" }, { status: 500 });

  const depth = Math.max(0, ...path.map((item: { depth?: number }) => item.depth ?? 0));
  const questionsExplored = path.length;
  const scoreIfCorrect = scoreRabbitHole(depth, questionsExplored, true);
  const scoreIfWrong = scoreRabbitHole(depth, questionsExplored, false);

  const { data: play, error } = await supabase.from("rabbit_hole_plays").insert({
    user_id: user.id,
    top_question_id: topQuestionId,
    timezone,
    local_day: localDay,
    used_bonus_play: mustUseBonus,
    path,
    interview: result.data,
    depth,
    questions_explored: questionsExplored,
  }).select("id").single();

  if (error || !play) return NextResponse.json({ error: "Failed to save play" }, { status: 500 });
  if (mustUseBonus) await supabase.from("profiles").update({ rabbit_hole_bonus_plays: bonusPlays - 1 }).eq("id", user.id);

  return NextResponse.json({ playId: play.id, interview: result.data, depth, questionsExplored, scoreIfCorrect, scoreIfWrong });
}
