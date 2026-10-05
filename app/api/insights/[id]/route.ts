import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { insightPowWindow, resolvePublicInsightWorkspaceTitle } from "@/lib/insight-share";

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

  const admin = createAdminClient();
  const workspaceTitle = await resolvePublicInsightWorkspaceTitle({
    workspaceId: insight.workspace_id,
    userScoped: supabase,
    admin,
  });
  const powCount = await loadInsightSessionPowCount(admin, insight);

  return NextResponse.json({
    insight: {
      ...insight,
      workspace_title: workspaceTitle,
      ...(powCount == null ? {} : { pow_count: powCount }),
    },
    isOwner,
    isAuthenticated: !!user,
  });
}

async function loadInsightSessionPowCount(
  admin: ReturnType<typeof createAdminClient>,
  insight: { id?: string | null; session_id?: string | null; created_at?: string | null },
): Promise<number | null> {
  const sessionId = String(insight.session_id || "").trim();
  const createdAt = String(insight.created_at || "").trim();
  if (!sessionId || !createdAt) return null;
  const [siblings, work] = await Promise.all([
    admin.from("insights").select("id, created_at").eq("session_id", sessionId).limit(200),
    admin
      .from("workspace_proof_of_work")
      .select("created_at")
      .eq("session_id", sessionId)
      .eq("proof_of_work_type", "tool")
      .limit(1000),
  ]);
  if (siblings.error || work.error) return null;
  return insightPowWindow({
    insightId: insight.id,
    createdAt,
    siblings: siblings.data ?? [],
    workCreatedAt: (work.data ?? []).map((row) => row.created_at),
  });
}
