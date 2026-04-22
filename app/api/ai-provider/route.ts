import { NextResponse } from "next/server";
import { getProviderInfo, AVAILABLE_MODELS } from "@/lib/xai-client";

/**
 * GET /api/ai-provider
 * Returns the active AI provider configuration.
 * Used by the admin dashboard to display provider status.
 */
export async function GET() {
  try {
    const info = getProviderInfo();

    return NextResponse.json({
      ...info,
      availableModels: AVAILABLE_MODELS,
    });
  } catch (error) {
    console.error("Error fetching AI provider info:", error);
    return NextResponse.json(
      { error: "Failed to fetch provider info" },
      { status: 500 }
    );
  }
}
