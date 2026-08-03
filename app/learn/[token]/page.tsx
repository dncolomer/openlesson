import { notFound } from "next/navigation";
import { AyclWorkspaceView } from "@/components/AyclWorkspaceView";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AyclLearnPage({ params }: PageProps) {
  const { token } = await params;
  const ctx = await resolveAyclAccess(token);

  if ("error" in ctx) notFound();

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