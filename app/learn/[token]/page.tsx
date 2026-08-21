import { notFound, redirect } from "next/navigation";
import { AyclWorkspaceView } from "@/components/AyclWorkspaceView";
import { redeemComplimentaryAyclLink } from "@/lib/aycl";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AyclLearnPage({ params }: PageProps) {
  const { token } = await params;
  const ctx = await resolveAyclAccess(token);

  if ("error" in ctx) {
    const redeemed = await redeemComplimentaryAyclLink(createAdminClient(), token);
    if ("error" in redeemed) notFound();
    redirect(`/learn/${redeemed.accessToken}`);
  }

  const { data: workspace, error: workspaceError } = await ctx.supabase
    .from("workspaces")
    .select("*")
    .eq("id", ctx.workspaceId)
    .single();

  if (workspaceError || !workspace) notFound();

  const { data: blocks } = await ctx.supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", ctx.workspaceId);

  return (
    <AyclWorkspaceView
      accessToken={token}
      ownerUserId={ctx.ownerUserId}
      initialPlan={workspace}
      initialNodes={blocks || []}
      accessTier={ctx.accessTier}
    />
  );
}