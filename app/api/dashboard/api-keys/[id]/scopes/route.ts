// ============================================
// Uncertain Systems Proof-of-Work API - Scope Management
// PATCH /api/dashboard/api-keys/:id/scopes → Update
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { errorResponse } from "@/lib/pow-api/auth";
import type { ApiKeyScope } from "@/lib/pow-api/types";

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

    const validatedScopes: ApiKeyScope[] = ["*"];

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

    // ── Update scopes via service role (client UPDATE removed) ──
    const now = new Date().toISOString();
    const admin = createAdminClient();

    const { data: updated, error: updateError } = await admin
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
