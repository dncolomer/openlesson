import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { processPendingMapReadyNotifications } from "@/lib/map-of-knowledge";

export const runtime = "nodejs";

/**
 * POST /api/map-of-knowledge/process-ready-notifications
 * Drain pending map-ready email notifies (cron / ops).
 *
 * Auth: Authorization: Bearer $CRON_SECRET or $MAP_READY_NOTIFY_SECRET
 */
export async function POST(req: NextRequest) {
  try {
    const secret = (
      process.env.CRON_SECRET ||
      process.env.MAP_READY_NOTIFY_SECRET ||
      ""
    ).trim();
    const auth = (req.headers.get("authorization") || "").trim();
    const bearer = auth.toLowerCase().startsWith("bearer ")
      ? auth.slice(7).trim()
      : "";
    if (!secret || bearer !== secret) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }

    const supabase = createAdminClient();
    const result = await processPendingMapReadyNotifications(supabase, { limit: 100 });
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("[api/map-of-knowledge/process-ready-notifications]", error);
    return NextResponse.json(
      { ok: false, error: "Process failed", code: "server_error" },
      { status: 500 },
    );
  }
}
