// ============================================
// OpenLesson Agentic API v2 - Scope Management
// PATCH /api/v2/agent/keys/:id/scopes → Update
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/agent-v2/auth";
import type { ApiKeyScope } from "@/lib/agent-v2/types";

const VALID_SCOPES: ApiKeyScope[] = [
  "*",
  "workspaces:read",
  "workspaces:write",
  "ghl:read",
  "ghl:write",
  "org:read",
  "org:write",
];

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(401, "unauthorized", "Authentication required");
    }

    // Validate UUID format
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!UUID_RE.test(id)) {
      return errorResponse(400, "validation_error", "Invalid key ID format");
    }

    // ── Parse & validate body ───────────────────────────────────
    let body: { scopes?: unknown };
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, "validation_error", "Request body must be valid JSON");
    }

    const { scopes } = body;

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return errorResponse(
        400,
        "validation_error",
        "scopes must be a non-empty array of strings"
      );
    }

    for (const scope of scopes) {
      if (typeof scope !== "string" || !VALID_SCOPES.includes(scope as ApiKeyScope)) {
        return errorResponse(400, "validation_error", `Invalid scope: "${scope}"`, {
          valid_scopes: VALID_SCOPES,
        });
      }
    }

    const validatedScopes = scopes as ApiKeyScope[];

    // ── Verify key ownership and active status ──────────────────
    const { data: existing, error: lookupError } = await supabase
      .from("agent_api_keys")
      .select("id, is_active")
      .eq("id", id)
      .eq("user_id", user.id)
      .single();

    if (lookupError || !existing) {
      return errorResponse(404, "not_found", "API key not found");
    }

    if (!existing.is_active) {
      return errorResponse(400, "validation_error", "Cannot update scopes on a revoked key");
    }

    // ── Update scopes ───────────────────────────────────────────
    const now = new Date().toISOString();

    const { data: updated, error: updateError } = await supabase
      .from("agent_api_keys")
      .update({ scopes: validatedScopes, updated_at: now })
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id, scopes, updated_at")
      .single();

    if (updateError || !updated) {
      console.error("[v2/keys/scopes] Update error:", updateError);
      return errorResponse(500, "internal_error", "Failed to update scopes");
    }

    return NextResponse.json({
      key: {
        id: updated.id,
        scopes: updated.scopes,
        updated_at: updated.updated_at,
      },
    });
  } catch (err) {
    console.error("[v2/keys/scopes] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
