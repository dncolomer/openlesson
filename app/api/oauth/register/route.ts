import { NextRequest, NextResponse } from "next/server";
import { getServiceClient } from "@/lib/agent-v2/auth";
import { registerOAuthClient } from "@/lib/agent-v2/mcp-oauth/clients";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      client_name?: string;
      redirect_uris?: string[];
      grant_types?: string[];
      token_endpoint_auth_method?: string;
    };

    if (!Array.isArray(body.redirect_uris) || body.redirect_uris.length === 0) {
      return NextResponse.json(
        { error: "invalid_client_metadata", error_description: "redirect_uris is required" },
        { status: 400 }
      );
    }

    const supabase = await getServiceClient();
    const client = await registerOAuthClient(supabase, {
      client_name: body.client_name,
      redirect_uris: body.redirect_uris,
      grant_types: body.grant_types,
      token_endpoint_auth_method: body.token_endpoint_auth_method,
    });
    return NextResponse.json(client, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "registration_failed";
    const status = message === "invalid_redirect_uri" ? 400 : 500;
    return NextResponse.json(
      { error: message, error_description: "Failed to register OAuth client" },
      { status }
    );
  }
}