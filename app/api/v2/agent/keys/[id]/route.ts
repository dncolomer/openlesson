// ============================================
// Uncertain Systems Agentic API v2 - Key Revocation
// DELETE /api/v2/agent/keys/:id → Soft-delete
// ============================================

import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/agent-v2/auth";

export async function DELETE(
  _req: NextRequest,
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

    // Verify the key exists and belongs to this user
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
      return errorResponse(400, "validation_error", "API key is already revoked");
    }

    // Soft-delete: set is_active = false
    const { error: updateError } = await supabase
      .from("agent_api_keys")
      .update({ is_active: false })
      .eq("id", id)
      .eq("user_id", user.id);

    if (updateError) {
      console.error("[v2/keys] Revoke key error:", updateError);
      return errorResponse(500, "internal_error", "Failed to revoke API key");
    }

    return NextResponse.json({ deleted: true, key_id: id });
  } catch (err) {
    console.error("[v2/keys] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
