/**
 * Global map-type library: official types only. Custom maps stay on the workspace.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { MAP_TYPE_LIBRARY } from "@/lib/map-type-library";

export const runtime = "nodejs";

export async function GET() {
  try {
    const official = MAP_TYPE_LIBRARY.map((e) => ({
      id: e.id,
      slug: e.id,
      label: e.label,
      description: e.description,
      category: e.category,
      categoryLabel: e.categoryLabel,
      strength: e.strength,
      strengthLabel: e.strengthLabel,
      playRule: e.playRule,
      literature: e.literature,
      useWhen: e.useWhen,
      occupied: e.occupied,
      blocked: e.blocked,
      defaultImported: e.defaultImported,
      authorUsername: e.authorUsername,
      origin: "official" as const,
    }));
    return NextResponse.json({ official, community: [] });
  } catch (error) {
    console.error("[map-types/library GET]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to load map type library",
    );
  }
}

export async function POST(_req: NextRequest) {
  return jsonError(403, "Custom map types cannot be published to the library");
}
