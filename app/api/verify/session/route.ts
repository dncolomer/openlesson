import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";

export async function GET(req: NextRequest) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return jsonError(401, "Not authenticated");

  const workspaceId = req.nextUrl.searchParams.get("workspaceId");
  if (!workspaceId) return jsonError(400, "workspaceId is required");

  const select = "id, status, created_at, kind, guest_link";
  const verify = await supabase
    .from("sessions")
    .select(select)
    .eq("user_id", user.id)
    .eq("kind", "verify")
    .order("created_at", { ascending: false })
    .limit(10);
  if (verify.error) return jsonError(500, verify.error.message);
  return NextResponse.json({ tapSessions: verify.data || [] });
}
