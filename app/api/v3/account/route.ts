import { NextRequest, NextResponse } from "next/server";
import { authenticateRequest, errorResponse } from "@/lib/pow-api/auth";
import { getAccountSettings, updateAccountSettings } from "@/lib/pow-api/workspace-management";
import { withProofOfWorkApiResponse } from "@/lib/pow-api/predictive-interruption";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:read");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  const account = await getAccountSettings(supabase, auth);
  return NextResponse.json(
    await withProofOfWorkApiResponse(account, { endpoint: "get_account_settings" }),
  );
}

export async function PATCH(req: NextRequest) {
  const result = await authenticateRequest(req, "workspaces:write");
  if (result instanceof NextResponse) return result;
  const { auth, supabase } = result;
  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    body = {};
  }
  try {
    const account = await updateAccountSettings(supabase, auth, body);
    return NextResponse.json(
      await withProofOfWorkApiResponse(account, { endpoint: "update_account_settings" }),
    );
  } catch (error) {
    return errorResponse(
      400,
      "validation_error",
      error instanceof Error ? error.message : "Failed to update account settings",
    );
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}
