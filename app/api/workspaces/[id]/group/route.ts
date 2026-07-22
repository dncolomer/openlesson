import { NextResponse } from "next/server";

/**
 * Group workspace mode is retired. Public workspaces contribute to the Map of Knowledge
 * instead of admitting non-owner participants via is_group.
 */
export async function PUT() {
  return NextResponse.json(
    {
      error: "Group workspace mode has been removed. Make the workspace public to contribute to the Map of Knowledge.",
      code: "group_mode_removed",
    },
    { status: 410 },
  );
}
