import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;
  const { playId } = await request.json();
  if (typeof playId !== "string") return jsonError(400, "Invalid play");

  const { data: play } = await supabase
    .from("rabbit_hole_plays")
    .select("id")
    .eq("id", playId)
    .eq("user_id", user.id)
    .not("completed_at", "is", null)
    .is("shared_at", null)
    .single();
  if (!play) return jsonError(400, "Play already shared or not found");

  const { data: updatedPlay, error: shareError } = await supabase
    .from("rabbit_hole_plays")
    .update({ shared_at: new Date().toISOString() })
    .eq("id", playId)
    .eq("user_id", user.id)
    .is("shared_at", null)
    .select("id")
    .single();
  if (shareError || !updatedPlay) return jsonError(400, "Play already shared or not found");

  const { data: profile } = await supabase.from("profiles").select("rabbit_hole_bonus_plays, rabbit_hole_bonus_points").eq("id", user.id).single();
  const bonusPlays = (profile?.rabbit_hole_bonus_plays ?? 0) + 1;
  const bonusPoints = (profile?.rabbit_hole_bonus_points ?? 0) + 10;
  await supabase.from("profiles").update({ rabbit_hole_bonus_plays: bonusPlays, rabbit_hole_bonus_points: bonusPoints }).eq("id", user.id);
  return NextResponse.json({ bonusPlays, bonusPoints });
}
