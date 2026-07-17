import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;
  const { playId } = await request.json();
  if (typeof playId !== "string") return NextResponse.json({ error: "Invalid play" }, { status: 400 });

  const { data: play } = await supabase
    .from("rabbit_hole_plays")
    .select("id")
    .eq("id", playId)
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .is("shared_at", null)
    .single();
  if (!play) return NextResponse.json({ error: "Play already shared or not found" }, { status: 400 });

  const { data: updatedPlay, error: shareError } = await supabase
    .from("rabbit_hole_plays")
    .update({ shared_at: new Date().toISOString() })
    .eq("id", playId)
    .eq("user_id", user.id)
    .is("shared_at", null)
    .select("id")
    .single();
  if (shareError || !updatedPlay) return NextResponse.json({ error: "Play already shared or not found" }, { status: 400 });

  const { data: profile } = await supabase.from("profiles").select("rabbit_hole_bonus_plays, rabbit_hole_bonus_points").eq("id", user.id).single();
  const bonusPlays = (profile?.rabbit_hole_bonus_plays ?? 0) + 1;
  const bonusPoints = (profile?.rabbit_hole_bonus_points ?? 0) + 10;
  await supabase.from("profiles").update({ rabbit_hole_bonus_plays: bonusPlays, rabbit_hole_bonus_points: bonusPoints }).eq("id", user.id);
  return NextResponse.json({ bonusPlays, bonusPoints });
}
