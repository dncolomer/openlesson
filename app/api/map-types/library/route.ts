/**
 * Global map-type library: official extras + community-published types.
 */
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { MAP_TYPE_LIBRARY } from "@/lib/map-type-library";
import { createAdminClient } from "@/lib/supabase/admin";
import { blankCustomMapType, normalizeCustomMapTypeRecord } from "@/lib/workspace-map-types";

export const runtime = "nodejs";

function slugify(label: string, seed: string): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 32);
  const tail = seed.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toLowerCase();
  return `${base || "maptype"}_${tail}`;
}

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
    let community: Array<Record<string, unknown>> = [];
    try {
      const admin = createAdminClient();
      const { data } = await admin
        .from("map_type_library")
        .select(
          "id, slug, label, description, category, strength, play_rule, literature, use_when, author_username, payload, created_at",
        )
        .order("created_at", { ascending: false })
        .limit(200);
      community = (data || []).map((row) => ({
        id: row.id,
        slug: row.slug,
        label: row.label,
        description: row.description,
        category: row.category || "community",
        categoryLabel: "Community",
        strength: row.strength || "custom",
        strengthLabel: "Community",
        playRule: row.play_rule || "",
        literature: row.literature || "",
        useWhen: row.use_when || "",
        occupied: Array.isArray(row.payload?.occupied) ? row.payload.occupied : [],
        blocked: Array.isArray(row.payload?.blocked) ? row.payload.blocked : [],
        payload: row.payload,
        defaultImported: false,
        authorUsername: row.author_username || "anonymous",
        origin: "community" as const,
      }));
    } catch {
      community = [];
    }
    return NextResponse.json({ official, community });
  } catch (error) {
    console.error("[map-types/library GET]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to load map type library",
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const body = (await req.json()) as Record<string, unknown>;
    const record = normalizeCustomMapTypeRecord(body.mapType);
    if (!record) {
      return jsonError(400, "A custom map type is required to publish");
    }
    const { data: profile } = await auth.supabase
      .from("profiles")
      .select("username")
      .eq("id", auth.user.id)
      .maybeSingle();
    const username =
      (typeof profile?.username === "string" && profile.username.trim()) ||
      "anonymous";
    const label =
      typeof body.label === "string" && body.label.trim()
        ? body.label.trim()
        : record.label;
    const slug = slugify(label, record.id);
    const payload = {
      ...blankCustomMapType({ id: record.id, label }),
      ...record,
      label,
      authorUsername: username,
      category: "community",
    };
    const { data, error } = await auth.supabase
      .from("map_type_library")
      .insert({
        slug,
        label,
        description: record.description,
        category: "community",
        strength: "custom",
        play_rule: typeof body.playRule === "string" ? body.playRule : "",
        literature: "",
        use_when: "",
        author_user_id: auth.user.id,
        author_username: username,
        payload,
      })
      .select("id, slug, author_username")
      .single();
    if (error) {
      console.error("[map-types/library POST]", error);
      return jsonError(500, "Failed to publish map type");
    }
    return NextResponse.json({
      id: data.id,
      slug: data.slug,
      authorUsername: data.author_username,
    });
  } catch (error) {
    console.error("[map-types/library POST]", error);
    return jsonError(
      500,
      error instanceof Error ? error.message : "Failed to publish map type",
    );
  }
}
