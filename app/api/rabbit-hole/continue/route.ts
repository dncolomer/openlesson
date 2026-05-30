import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const { rootQuestion } = await request.json();
  if (!rootQuestion || typeof rootQuestion !== "string") return NextResponse.json({ error: "Missing root question" }, { status: 400 });

  const { data: plan, error } = await supabase.from("learning_plans").insert({
    user_id: user.id,
    title: rootQuestion.slice(0, 80),
    root_topic: rootQuestion,
    status: "active",
  }).select("id").single();
  if (error || !plan) return NextResponse.json({ error: "Failed to create lesson" }, { status: 500 });
  return NextResponse.json({ planId: plan.id });
}
