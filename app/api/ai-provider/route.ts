import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { createClient } from "@/lib/supabase/server";
import { getProviderInfo, AVAILABLE_MODELS } from "@/lib/xai-client";

/**
 * GET /api/ai-provider
 * Returns the active AI provider configuration.
 * Restricted to authenticated platform admins.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return jsonError(401, "Unauthorized");
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.is_admin) {
      return jsonError(403, "Forbidden");
    }

    const info = getProviderInfo();

    return NextResponse.json({
      ...info,
      availableModels: AVAILABLE_MODELS,
    });
  } catch (error) {
    console.error("Error fetching AI provider info:", error);
    return jsonError(500, "Failed to fetch provider info");
  }
}
