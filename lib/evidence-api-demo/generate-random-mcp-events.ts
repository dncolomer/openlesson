import type { EvidenceApiDemoDefinition } from "./demo-definition";
import type { McpSimulationEvent } from "./mcp-simulation-types";

const RANDOM_MCP_TOOLS = [
  "list_activity",
  "fetch_workspace_events",
  "sync_integration",
  "get_learner_trace",
] as const;

const FALLBACK_EVENTS = [
  {
    id: "connect_integration",
    label: "Connect integration",
    description: "OAuth handshake completed for external workspace.",
    outcome: "success" as const,
  },
  {
    id: "import_records",
    label: "Import records",
    description: "Bulk import finished with partial field mapping warnings.",
    outcome: "partial" as const,
  },
  {
    id: "configure_workflow",
    label: "Configure workflow",
    description: "Automation rules saved and validated against sandbox data.",
    outcome: "success" as const,
  },
  {
    id: "invite_teammate",
    label: "Invite teammate",
    description: "Manager invite sent with role-based permissions.",
    outcome: "success" as const,
  },
  {
    id: "recover_misconfiguration",
    label: "Recover misconfiguration",
    description: "User fixed scope error after failed webhook delivery.",
    outcome: "struggle" as const,
  },
  {
    id: "return_after_idle",
    label: "Return after idle gap",
    description: "Learner resumed setup after a week away from the product.",
    outcome: "partial" as const,
  },
];

function clampCount(count: number): number {
  if (!Number.isFinite(count)) return 5;
  return Math.min(24, Math.max(1, Math.floor(count)));
}

function pickRandom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

export function generateRandomMcpEvents(
  count: number,
  demo: EvidenceApiDemoDefinition,
  planId?: string | null
): McpSimulationEvent[] {
  const total = clampCount(count);
  const evidenceActions = demo.actions.filter((action) => action.kind === "evidence");
  const pool =
    evidenceActions.length > 0
      ? evidenceActions.map((action) => ({
          id: action.id,
          label: action.label,
          description: action.description,
          outcome: action.outcome,
        }))
      : FALLBACK_EVENTS;

  const now = Date.now();

  return Array.from({ length: total }, (_, index) => {
    const template = pickRandom(pool);
    const verb = `${template.id}_${index + 1}`;
    const mcpTool = RANDOM_MCP_TOOLS[index % RANDOM_MCP_TOOLS.length];

    return {
      id: crypto.randomUUID(),
      verb,
      label: template.label,
      description: template.description,
      timestamp: new Date(now - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
      mcpTool,
      outcome: template.outcome ?? "success",
      sourceData: {
        simulated: true,
        random_batch: true,
        workspace_id: planId ?? null,
        product: demo.productName,
        index: index + 1,
        batch_size: total,
      },
      status: "pending",
    };
  });
}