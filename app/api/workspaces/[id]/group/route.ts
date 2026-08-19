import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";

/**
 * Group workspace mode is retired. Public workspaces contribute to the Map of Knowledge
 * instead of admitting non-owner participants via is_group.
 */
export async function PUT() {
  return jsonError(410, "Group workspace mode has been removed. Make the workspace public to contribute to the Map of Knowledge.", "group_mode_removed");
}
