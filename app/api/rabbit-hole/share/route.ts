import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { playId } = await request.json();

  const { data: profile } = await supabase.from("profiles").select("rabbit_hole_bonus_plays, rabbit_hole_bonus_points").eq("id", user.id).single();
  await supabase.from("rabbit_hole_plays").update({ shared_at: new Date().toISOString() }).eq("id", playId).eq("user_id", user.id);
  const bonusPlays = (profile?.rabbit_hole_bonus_plays ?? 0) + 1;
  const bonusPoints = (profile?.rabbit_hole_bonus_points ?? 0) + 10;
  await supabase.from("profiles").update({ rabbit_hole_bonus_plays: bonusPlays, rabbit_hole_bonus_points: bonusPoints }).eq("id", user.id);
  return NextResponse.json({ bonusPlays, bonusPoints });
}
