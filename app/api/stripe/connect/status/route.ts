import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { presentConnectStatus } from "@/lib/credits/aycl-connect";

export const runtime = "nodejs";

export async function GET() {
  const auth = await requireAuthenticatedUser();
  if (!auth.ok) return auth.response;
  const { data, error } = await auth.supabase
    .from("profiles")
    .select("stripe_connect_account_id, stripe_connect_charges_enabled")
    .eq("id", auth.user.id)
    .maybeSingle();
  if (error) return jsonError(500, error.message);
  return NextResponse.json(
    presentConnectStatus({
      accountId: data?.stripe_connect_account_id ?? null,
      chargesEnabled: Boolean(data?.stripe_connect_charges_enabled),
    }),
  );
}
