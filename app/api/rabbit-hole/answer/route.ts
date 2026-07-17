import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { scoreRabbitHole } from "@/lib/rabbit-hole";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;
  const { playId, choiceIndex } = await request.json();
  if (typeof playId !== "string" || !Number.isInteger(choiceIndex) || choiceIndex < 0 || choiceIndex > 2) return NextResponse.json({ error: "Invalid answer" }, { status: 400 });

  const { data: play } = await supabase.from("rabbit_hole_plays").select("id, interview, depth, questions_explored, score, completed_at").eq("id", playId).eq("user_id", user.id).single();
  if (!play) return NextResponse.json({ error: "Play not found" }, { status: 404 });
  if (play.completed_at) {
    const interview = play.interview as { correctIndex?: number } | null;
    return NextResponse.json({ correct: choiceIndex === interview?.correctIndex, score: play.score ?? 0 });
  }

  const interview = play.interview as { correctIndex?: number } | null;
  if (!Number.isInteger(interview?.correctIndex)) return NextResponse.json({ error: "Invalid interview" }, { status: 400 });
  const correct = choiceIndex === interview?.correctIndex;
  const score = scoreRabbitHole(play.depth ?? 0, play.questions_explored ?? 0, correct);
  await supabase.from("rabbit_hole_plays").update({ score, completed_at: new Date().toISOString() }).eq("id", play.id);
  return NextResponse.json({ correct, score });
}
