import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

function safeRedirectPath(next: string | null) {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return "/dashboard";
  return next;
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = safeRedirectPath(requestUrl.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      const email = user?.email?.trim().toLowerCase();
      if (user && email) {
        const admin = createAdminClient();
        const { data: guest } = await admin
          .from("organization_guest_users")
          .select("id, organization_id, status")
          .eq("email", email)
          .eq("status", "active")
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        if (guest) {
          await admin
            .from("profiles")
            .update({ organization_id: guest.organization_id, is_org_admin: false })
            .eq("id", user.id);

          await admin
            .from("workspace_tap_sessions")
            .update({ user_id: user.id })
            .eq("guest_user_id", guest.id)
            .is("user_id", null);

          await admin
            .from("agent_api_keys")
            .update({ user_id: user.id })
            .eq("guest_user_id", guest.id)
            .is("user_id", null);

          await admin
            .from("organization_guest_users")
            .update({ status: "claimed", claimed_by_user_id: user.id, claimed_at: new Date().toISOString() })
            .eq("id", guest.id);
        }
      }
      return NextResponse.redirect(new URL(next, requestUrl.origin));
    }
  }

  return NextResponse.redirect(new URL("/login", requestUrl.origin));
}
