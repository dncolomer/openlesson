import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
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

  if (error || !insight || insight.archived_at) {
    return jsonError(404, "Insight not found");
  }

  const isOwner = user?.id === insight.user_id;
  if (!insight.is_public && !isOwner) {
    return jsonError(404, "Insight not found");
  }

  return NextResponse.json({ insight, isOwner, isAuthenticated: !!user });
}