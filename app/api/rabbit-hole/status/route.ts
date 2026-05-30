import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUserTimezone, localDayKey } from "@/lib/rabbit-hole";

export async function GET(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const timezone = getUserTimezone(request.nextUrl.searchParams.get("timezone"));
  const day = localDayKey(timezone);

  const [{ data: profile }, { data: plays }] = await Promise.all([
    supabase.from("profiles").select("is_admin, rabbit_hole_bonus_plays").eq("id", user.id).single(),
    supabase.from("rabbit_hole_plays").select("id").eq("user_id", user.id).eq("local_day", day).eq("used_bonus_play", false),
  ]);

  const freePlayUsedToday = (plays?.length ?? 0) > 0;
  const isAdmin = profile?.is_admin ?? false;
  const bonusPlays = profile?.rabbit_hole_bonus_plays ?? 0;

  return NextResponse.json({
    timezone,
    isAdmin,
    freePlayUsedToday,
    bonusPlays,
    playsAvailable: isAdmin ? 999 : (freePlayUsedToday ? 0 : 1) + bonusPlays,
  });
}
