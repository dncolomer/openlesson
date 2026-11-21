export type LtiContextRegionBind = {
  platformId: string;
  deploymentId: string;
  contextId: string;
  knowledgeRegionId: string;
};

export function parseContextRegionBind(
  raw: Record<string, unknown>,
): LtiContextRegionBind | { error: string } {
  const platformId = String(raw.platformId ?? raw.platform_id ?? "").trim();
  const deploymentId = String(raw.deploymentId ?? raw.deployment_id ?? "").trim();
  const contextId = String(raw.contextId ?? raw.context_id ?? "").trim();
  const knowledgeRegionId = String(
    raw.knowledgeRegionId ?? raw.knowledge_region_id ?? raw.regionId ?? "",
  ).trim();
  if (!platformId) return { error: "platform_id is required" };
  if (!deploymentId) return { error: "deployment_id is required" };
  if (!contextId) return { error: "context_id is required" };
  if (!knowledgeRegionId) return { error: "knowledge_region_id is required" };
  return { platformId, deploymentId, contextId, knowledgeRegionId };
}

export function contextRegionKey(bind: {
  platformId: string;
  deploymentId: string;
  contextId: string;
}): string {
  return `${bind.platformId}:${bind.deploymentId}:${bind.contextId}`;
}
