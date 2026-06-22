import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { authenticateRequest, errorResponse } from "@/lib/agent-v2/auth";
import { hashApiKey } from "@/lib/x402";
import type { ApiKeyScope } from "@/lib/agent-v2/types";

export const runtime = "nodejs";

const GUEST_SCOPES: ApiKeyScope[] = ["workspaces:read", "ghl:read", "ghl:write"];

function normalizeEmail(value: unknown) {
  return typeof value === "string" ? value.trim().toLowerCase() : "";
}

export async function POST(req: NextRequest) {
  const result = await authenticateRequest(req, "org:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;

  if (!auth.user_id || !auth.organization_id || !auth.is_org_admin) {
    return errorResponse(403, "forbidden", "Only organization admins can create guest users");
  }

  const body = await req.json().catch(() => ({}));
  const email = normalizeEmail(body.email);
  if (!email || !email.includes("@")) {
    return errorResponse(400, "validation_error", "A valid email is required");
  }

  const { data: existingRealUser } = await supabase
    .from("profiles")
    .select("id, organization_id")
    .eq("email", email)
    .maybeSingle();

  if (existingRealUser && existingRealUser.organization_id && existingRealUser.organization_id !== auth.organization_id) {
    return errorResponse(409, "forbidden", "A real user with this email belongs to another organization");
  }

  let guest = null;
  const { data: existingGuest } = await supabase
    .from("organization_guest_users")
    .select("id, organization_id, email, status, claimed_by_user_id, claimed_at, created_at")
    .eq("organization_id", auth.organization_id)
    .eq("email", email)
    .maybeSingle();

  if (existingGuest) {
    guest = existingGuest;
  } else {
    const { data: insertedGuest, error: guestError } = await supabase
      .from("organization_guest_users")
      .insert({
        organization_id: auth.organization_id,
        email,
        created_by_user_id: auth.user_id,
        created_by_api_key_id: auth.key_id,
      })
      .select("id, organization_id, email, status, claimed_by_user_id, claimed_at, created_at")
      .single();

    if (guestError || !insertedGuest) {
      console.error("[agent/org/guests] Guest create error:", guestError);
      return errorResponse(500, "internal_error", "Failed to create guest user");
    }
    guest = insertedGuest;
  }

  const rawKey = `gsk_${crypto.randomBytes(24).toString("hex")}`;
  const keyHash = await hashApiKey(rawKey);
  const keyPrefix = rawKey.substring(0, 13);

  const { data: key, error: keyError } = await supabase
    .from("agent_api_keys")
    .insert({
      user_id: null,
      guest_user_id: guest.id,
      organization_id: auth.organization_id,
      key_hash: keyHash,
      key_prefix: keyPrefix,
      label: `Guest ${email}`,
      scopes: GUEST_SCOPES,
      rate_limit: 120,
      is_active: true,
    })
    .select("id, key_prefix, scopes, rate_limit, created_at")
    .single();

  if (keyError || !key) {
    console.error("[agent/org/guests] Guest key create error:", keyError);
    return errorResponse(500, "internal_error", "Failed to create guest API key");
  }

  return NextResponse.json(
    {
      guest_user: guest,
      api_key: rawKey,
      key,
    },
    { status: existingGuest ? 200 : 201 }
  );
}
