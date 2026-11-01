import { createClient } from "@/lib/supabase/server";
import { jsonError } from "@/lib/api-error-envelope";
import { isInsufficientCreditsError } from "@/lib/credits/account";

export async function runnerUserIdFromCookies(): Promise<string | null> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    return user?.id ?? null;
  } catch {
    return null;
  }
}

export function insufficientCreditsResponse(error: unknown) {
  if (!isInsufficientCreditsError(error)) return null;
  return jsonError(402, error.message, "insufficient_credits", {
    balance: error.balance,
    cost: error.amount,
    renew_url: "/pricing",
  });
}
