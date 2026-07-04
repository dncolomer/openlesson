import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { data: insight, error } = await supabase
    .from("insights")
    .select("*")
    .or(`id.eq.${id},share_token.eq.${id}`)
    .maybeSingle();

  if (error || !insight) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }

  const isOwner = user?.id === insight.user_id;
  if (!insight.is_public && !isOwner) {
    return NextResponse.json({ error: "Insight not found" }, { status: 404 });
  }

  return NextResponse.json({ insight, isOwner });
}