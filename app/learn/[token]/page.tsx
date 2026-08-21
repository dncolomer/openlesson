import { AyclLearnInvalidLink, AyclLearnRedirect } from "@/components/AyclLearnRedirect";
import { AyclWorkspaceView } from "@/components/AyclWorkspaceView";
import { getAyclComplimentaryLinkByToken } from "@/lib/aycl";
import { complimentaryLinkLandingPath } from "@/lib/aycl-complimentary";
import { resolveAyclAccess } from "@/lib/aycl-session-auth";
import { createAdminClient } from "@/lib/supabase/admin";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function AyclLearnPage({ params }: PageProps) {
  const { token } = await params;
  const ctx = await resolveAyclAccess(token);

  if ("error" in ctx) {
    const link = await getAyclComplimentaryLinkByToken(createAdminClient(), token);
    if (link) {
      return (
        <AyclLearnRedirect href={complimentaryLinkLandingPath(link.workspace_id, token)} />
      );
    }
    return <AyclLearnInvalidLink />;
  }

  const { data: workspace, error: workspaceError } = await ctx.supabase
    .from("workspaces")
    .select("*")
    .eq("id", ctx.workspaceId)
    .single();

  if (workspaceError || !workspace) {
    return <AyclLearnInvalidLink />;
  }

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
