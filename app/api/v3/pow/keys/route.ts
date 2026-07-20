// ============================================
// Uncertain Systems Proof-of-Work API - Key Management
// GET  /api/v3/pow/keys   → List keys
// POST /api/v3/pow/keys   → Create key
// ============================================

import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";
import { errorResponse } from "@/lib/agent-v2/auth";
import { resolveBillingEntity, billingEntityHasApiAccess } from "@/lib/billing-entity";
import { createAdminClient } from "@/lib/supabase/admin";
import { DEFAULT_API_KEY_SCOPES, validateAssignableScopes } from "@/lib/agent-v2/scopes";
import type { ApiKeyScope } from "@/lib/agent-v2/types";

const VALID_SCOPES: ApiKeyScope[] = [
  "*",
  "workspaces:read",
  "workspaces:write",
  "tap:read",
  "tap:write",
  "org:read",
  "org:write",
];

const MAX_KEYS_PER_USER = 10;
const DEFAULT_SCOPES: ApiKeyScope[] = DEFAULT_API_KEY_SCOPES;
const DEFAULT_RATE_LIMIT = 120;

// ─── GET: List all API keys for the authenticated user ──────────────

export async function GET(_req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(401, "unauthorized", "Authentication required");
    }

    const { data: keys, error } = await supabase
      .from("agent_api_keys")
      .select(
        "id, label, key_prefix, scopes, rate_limit, is_active, created_at, last_used_at, expires_at"
      )
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("[v2/keys] List keys error:", error);
      return errorResponse(500, "internal_error", "Failed to list API keys");
    }

    return NextResponse.json({ keys: keys || [] });
  } catch (err) {
    console.error("[v2/keys] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}

// ─── POST: Create a new API key ────────────────────────────────────

interface CreateKeyBody {
  label?: string;
  scopes?: string[];
  expires_in_days?: number;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return errorResponse(401, "unauthorized", "Authentication required");
    }

    // ── Check Pro subscription ──────────────────────────────────
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, subscription_status, is_admin, organization_id, is_org_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      console.error("[v2/keys] Profile lookup error:", profileError);
      return errorResponse(500, "internal_error", "Failed to verify subscription");
    }

    const isAdmin = profile.is_admin === true;
    let hasApiAccess = isAdmin;
    if (!hasApiAccess) {
      let org = null;
      if (profile.organization_id) {
        const admin = createAdminClient();
        const { data: orgRow } = await admin
          .from("organizations")
          .select(
            "id, plan, subscription_status, current_period_end, extra_lessons, billing_mode, archived_at"
          )
          .eq("id", profile.organization_id)
          .maybeSingle();
        org = orgRow;
      }
      const entity = resolveBillingEntity(
        {
          plan: profile.plan,
          is_admin: profile.is_admin,
          extra_lessons: 0,
          subscription_status: profile.subscription_status,
          current_period_end: null,
          token_tier: null,
          token_validity_expires_at: null,
          organization_id: profile.organization_id,
        },
        org
      );
      hasApiAccess = billingEntityHasApiAccess(entity);
    }

    if (!hasApiAccess) {
      return errorResponse(
        403,
        "api_plan_required",
        "The Proof-of-Work API requires Pro / Teams or API Metered.",
        { renew_url: "https://uncertain.systems/pricing" }
      );
    }

    // ── Parse & validate body ───────────────────────────────────
    let body: CreateKeyBody = {};
    try {
      body = await req.json();
    } catch {
      // Empty body is fine — all fields are optional
    }

    const { label, scopes: rawScopes, expires_in_days } = body;

    // Validate label
    if (label !== undefined && (typeof label !== "string" || label.length > 128)) {
      return errorResponse(400, "validation_error", "Label must be a string with at most 128 characters");
    }

    // Validate scopes
    const scopes: ApiKeyScope[] = rawScopes
      ? (rawScopes as ApiKeyScope[])
      : DEFAULT_SCOPES;

    if (!Array.isArray(scopes) || scopes.length === 0) {
      return errorResponse(400, "validation_error", "Scopes must be a non-empty array");
    }

    for (const scope of scopes) {
      if (!VALID_SCOPES.includes(scope)) {
        return errorResponse(400, "validation_error", `Invalid scope: "${scope}"`, {
          valid_scopes: VALID_SCOPES,
        });
      }
    }

    const scopeCheck = validateAssignableScopes(scopes, profile);
    if (!scopeCheck.ok) {
      return errorResponse(403, "forbidden", scopeCheck.message);
    }

    // Validate expires_in_days
    if (expires_in_days !== undefined) {
      if (
        typeof expires_in_days !== "number" ||
        !Number.isInteger(expires_in_days) ||
        expires_in_days < 1 ||
        expires_in_days > 365
      ) {
        return errorResponse(
          400,
          "validation_error",
          "expires_in_days must be an integer between 1 and 365"
        );
      }
    }

    // ── Enforce key limit ───────────────────────────────────────
    const { count, error: countError } = await supabase
      .from("agent_api_keys")
      .select("id", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("is_active", true);

    if (countError) {
      console.error("[v2/keys] Count keys error:", countError);
      return errorResponse(500, "internal_error", "Failed to check key limit");
    }

    if ((count ?? 0) >= MAX_KEYS_PER_USER) {
      return errorResponse(
        403,
        "forbidden",
        `You may have at most ${MAX_KEYS_PER_USER} active API keys. Revoke an existing key first.`
      );
    }

    // ── Generate key material ───────────────────────────────────
    const rawKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(rawKey).digest("hex");
    const keyPrefix = rawKey.substring(0, 12);

    const expiresAt = expires_in_days
      ? new Date(Date.now() + expires_in_days * 86_400_000).toISOString()
      : null;

    // ── Insert via service role (client INSERT policy removed) ──
    const admin = createAdminClient();
    const { data: inserted, error: insertError } = await admin
      .from("agent_api_keys")
      .insert({
        user_id: user.id,
        organization_id: profile.organization_id || null,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: label || null,
        scopes,
        rate_limit: DEFAULT_RATE_LIMIT,
        is_active: true,
        expires_at: expiresAt,
      })
      .select("id, label, key_prefix, scopes, rate_limit, created_at, expires_at")
      .single();

    if (insertError) {
      console.error("[v2/keys] Insert key error:", insertError);
      return errorResponse(500, "internal_error", "Failed to create API key");
    }

    return NextResponse.json(
      {
        key: {
          id: inserted.id,
          label: inserted.label,
          key_prefix: inserted.key_prefix,
          scopes: inserted.scopes,
          rate_limit: inserted.rate_limit,
          created_at: inserted.created_at,
          expires_at: inserted.expires_at,
        },
        api_key: rawKey,
      },
      { status: 201 }
    );
  } catch (err) {
    console.error("[v2/keys] Unexpected error:", err);
    return errorResponse(500, "internal_error", "Internal server error");
  }
}
