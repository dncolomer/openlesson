import { NextRequest, NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getUserTimezone, localDayKey } from "@/lib/rabbit-hole";

export async function GET(request: NextRequest) {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

  const timezone = getUserTimezone(request.nextUrl.searchParams.get("timezone"));
  const day = localDayKey(timezone);

  const [{ data: profile }, { data: plays }, { data: scoredPlays }] = await Promise.all([
    supabase.from("profiles").select("is_admin, rabbit_hole_bonus_plays").eq("id", user.id).single(),
    supabase.from("rabbit_hole_plays").select("id").eq("user_id", user.id).eq("local_day", day).eq("used_bonus_play", false),
    supabase.from("rabbit_hole_plays").select("user_id, score").not("score", "is", null),
  ]);

  const freePlayUsedToday = (plays?.length ?? 0) > 0;
  const isAdmin = profile?.is_admin ?? false;
  const bonusPlays = profile?.rabbit_hole_bonus_plays ?? 0;
  const freePlaysAvailable = isAdmin ? 999 : freePlayUsedToday ? 0 : 1;
  const totals = new Map<string, number>();
  for (const play of scoredPlays ?? []) {
    totals.set(play.user_id, (totals.get(play.user_id) ?? 0) + (play.score ?? 0));
  }
  const points = totals.get(user.id) ?? 0;
  const higherScores = new Set(Array.from(totals.values()).filter((total) => total > points));
  const globalRank = points > 0 ? higherScores.size + 1 : null;

  return NextResponse.json({
    timezone,
    isAdmin,
    freePlayUsedToday,
    bonusPlays,
    freePlaysAvailable,
    playsAvailable: freePlaysAvailable + bonusPlays,
    points,
    globalRank,
  });
}
