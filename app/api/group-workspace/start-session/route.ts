import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";

export const runtime = "nodejs";

/**
 * Group-workspace participant sessions are retired.
 * Use TAP / ILE guest links or own a workspace to start sessions.
 */
export async function POST() {
  return jsonError(410, "Group workspace sessions are no longer available. Start a TAP or ILE session via a guest link, or use your own workspace.", "group_mode_removed",);
}
