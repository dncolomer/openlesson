import { NextRequest, NextResponse } from "next/server";
import crypto from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: keys, error } = await supabase
      .from("agent_api_keys")
      .select(`
        id,
        key_prefix,
        label,
        rate_limit,
        is_active,
        created_at,
        last_used_at
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("List keys error:", error);
      return NextResponse.json({ error: "Failed to list keys" }, { status: 500 });
    }

    const keysWithUsage = await Promise.all((keys || []).map(async (key) => {
      const { count: usageCount } = await supabase
        .from("sessions")
        .select("*", { count: "exact", head: true })
        .eq("agent_api_key_id", key.id);

      return {
        ...key,
        usage_count: usageCount || 0,
      };
    }));

    return NextResponse.json({ keys: keysWithUsage });
  } catch (error) {
    console.error("List keys error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { label } = await request.json();

    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("plan, subscription_status, is_admin")
      .eq("id", user.id)
      .single();

    if (profileError || !profile) {
      return NextResponse.json({ error: "Failed to verify subscription" }, { status: 500 });
    }

    const isAdmin = profile.is_admin === true;
    const isPro = profile.plan === "pro" && profile.subscription_status === "active";

    if (!isAdmin && !isPro) {
      return NextResponse.json({ error: "A Pro subscription is required to create API keys" }, { status: 403 });
    }

    const apiKey = `sk_${crypto.randomBytes(24).toString("hex")}`;
    const keyHash = crypto.createHash("sha256").update(apiKey).digest("hex");
    const keyPrefix = apiKey.substring(0, 12);

    const { data: key, error: insertError } = await supabase
      .from("agent_api_keys")
      .insert({
        user_id: user.id,
        key_hash: keyHash,
        key_prefix: keyPrefix,
        label: label || null,
        rate_limit: 100,
        is_active: true,
      })
      .select()
      .single();

    if (insertError) {
      console.error("Create key error:", insertError);
      return NextResponse.json({ error: "Failed to create key" }, { status: 500 });
    }

    return NextResponse.json({
      key: {
        id: key.id,
        key: apiKey,
        key_prefix: keyPrefix,
        label: key.label,
        rate_limit: key.rate_limit,
        is_active: key.is_active,
        created_at: key.created_at,
      },
    });
  } catch (error) {
    console.error("Create key error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
