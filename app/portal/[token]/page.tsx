import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashPrivateToken } from "@/lib/private-token";
import { aestheticImageForId } from "@/lib/aesthetics";
import {
  buildPracticePortalLandingView,
  classifyPracticePortalLookup,
  normalizePracticePortalConfig,
} from "@/lib/practice-portal";
import { PracticePortalLandingClient } from "@/components/PracticePortalLandingClient";
import { PracticePortalShell } from "@/components/PracticePortalShell";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Same Greco-futurism default language as Map of Knowledge when id hash pool is empty. */
const PORTAL_FALLBACK_BG = "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg";

interface PageProps {
  params: Promise<{ token: string }>;
}

function portalBackgroundForWorkspace(workspaceId: string): string {
  return aestheticImageForId(workspaceId) || PORTAL_FALLBACK_BG;
}

function PortalErrorBody({
  title,
  body,
  detail,
}: {
  title: string;
  body: string;
  detail?: string;
}) {
  return (
    <div
      className="rounded-sm border border-zinc-800 bg-zinc-950/80 p-6 text-center backdrop-blur-sm sm:p-8"
      data-practice-portal-error-panel
    >
      <div className="mb-3 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
        Knowledge Portal
      </div>
      <h1 className="text-xl font-medium tracking-[-0.5px] text-white sm:text-2xl">
        {title}
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-zinc-400">{body}</p>
      {detail ? (
        <p className="mt-4 font-mono text-xs text-red-300/90">{detail}</p>
      ) : null}
    </div>
  );
}

/**
 * Public Practice Portal landing at `/portal/{token}` — unauthenticated.
 * Map-of-Knowledge aesthetics shell; visitors mint TAP/ILE guest links.
 *
 * 404 only for missing/revoked tokens (and missing/archived workspace).
 * Query/storage failures render an error surface (non-404).
 */
export default async function PracticePortalPage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) notFound();

  let supabase;
  try {
    supabase = createAdminClient();
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Supabase admin client is not configured";
    return (
      <PracticePortalShell backgroundImage={PORTAL_FALLBACK_BG} errorCode="config">
        <PortalErrorBody
          title="Practice Portal unavailable"
          body="This environment cannot load portals right now."
          detail={message}
        />
      </PracticePortalShell>
    );
  }

  const tokenHash = hashPrivateToken(token);

  const { data: portal, error: portalError } = await supabase
    .from("workspace_practice_portals")
    .select("id, workspace_id, status, config, label")
    .eq("private_token_hash", tokenHash)
    .maybeSingle();

  const portalClass = classifyPracticePortalLookup({
    data: portal,
    error: portalError,
  });

  if (portalClass.outcome === "storage_error") {
    console.error("[portal] Resolve storage error:", portalError);
    return (
      <PracticePortalShell backgroundImage={PORTAL_FALLBACK_BG} errorCode="storage">
        <PortalErrorBody
          title="Practice Portal unavailable"
          body="Could not load this portal due to a storage error. If you just set this up, ensure the practice portals migration is applied."
          detail={portalClass.message}
        />
      </PracticePortalShell>
    );
  }

  if (portalClass.outcome === "not_found" || portalClass.outcome === "revoked") {
    notFound();
  }

  if (!portal) notFound();

  const { data: workspace, error: workspaceError } = await supabase
    .from("workspaces")
    .select("id, title, root_topic, archived_at")
    .eq("id", portal.workspace_id)
    .maybeSingle();

  if (workspaceError) {
    console.error("[portal] Workspace lookup error:", workspaceError);
    return (
      <PracticePortalShell
        backgroundImage={PORTAL_FALLBACK_BG}
        errorCode="workspace_storage"
      >
        <PortalErrorBody
          title="Practice Portal unavailable"
          body="Could not load the workspace for this portal."
          detail={workspaceError.message}
        />
      </PracticePortalShell>
    );
  }

  if (!workspace || workspace.archived_at != null) notFound();

  const { data: blocks } = await supabase
    .from("blocks")
    .select("id, title, is_start")
    .eq("workspace_id", portal.workspace_id)
    .order("created_at", { ascending: true });

  const config = normalizePracticePortalConfig(portal.config);
  const landing = buildPracticePortalLandingView({
    config,
    workspace: {
      id: workspace.id,
      title: workspace.title,
      root_topic: workspace.root_topic,
    },
    blocks: blocks || [],
    portal_id: portal.id,
  });

  const backgroundImage = portalBackgroundForWorkspace(workspace.id);

  return (
    <PracticePortalShell backgroundImage={backgroundImage}>
      <PracticePortalLandingClient
        token={token}
        workspace={landing.workspace}
        label={portal.label ?? null}
        products={landing.products}
        blocks={landing.blocks}
        fixedBlockId={landing.fixed_block_id}
      />
    </PracticePortalShell>
  );
}
