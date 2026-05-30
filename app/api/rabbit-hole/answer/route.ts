import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { scoreRabbitHole } from "@/lib/rabbit-hole";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { playId, choiceIndex } = await request.json();

  const { data: play } = await supabase.from("rabbit_hole_plays").select("id, interview, depth, questions_explored").eq("id", playId).eq("user_id", user.id).single();
  if (!play) return NextResponse.json({ error: "Play not found" }, { status: 404 });

  const interview = play.interview as { correctIndex?: number } | null;
  const correct = choiceIndex === interview?.correctIndex;
  const score = scoreRabbitHole(play.depth ?? 0, play.questions_explored ?? 0, correct);
  await supabase.from("rabbit_hole_plays").update({ score, completed_at: new Date().toISOString() }).eq("id", play.id);
  return NextResponse.json({ correct, score });
}
