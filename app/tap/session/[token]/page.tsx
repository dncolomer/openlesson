import { notFound, redirect } from "next/navigation";
import { hashPrivateToken } from "@/lib/tap-score";
import { createAdminClient } from "@/lib/supabase/admin";
import { flowSessionPath } from "@/lib/guest-link-access";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

function queryString(query: Record<string, string | string[] | undefined>): string {
  const sp = new URLSearchParams();
  for (const [key, value] of Object.entries(query)) {
    if (typeof value === "string") sp.set(key, value);
    else if (Array.isArray(value)) for (const item of value) sp.append(key, item);
  }
  const qs = sp.toString();
  return qs ? `?${qs}` : "";
}

export default async function LegacyTapSessionRedirect({ params, searchParams }: PageProps) {
  const { token } = await params;
  const query = await searchParams;
  const supabase = createAdminClient();
  const tokenHash = hashPrivateToken(token);
  const tapSessionSelect = "id, status, interaction_kind, public_token, access_mode";

  let session: Record<string, unknown> | null = null;
  const { data: byHash } = await supabase
    .from("workspace_tap_sessions")
    .select(tapSessionSelect)
    .eq("private_token_hash", tokenHash)
    .maybeSingle();
  session = byHash;
  if (!session) {
    const { data: byPublic } = await supabase
      .from("workspace_tap_sessions")
      .select(tapSessionSelect)
      .eq("public_token", token)
      .eq("access_mode", "public")
      .maybeSingle();
    session = byPublic;
  }
  if (!session) notFound();

  const path = flowSessionPath("tap", String(session.interaction_kind || ""));
  redirect(`${path}/${token}${queryString(query)}`);
}
