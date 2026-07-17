import type { ProofOfWorkApiDemoDefinition } from "./demo-definition";
import type { DemoWorkspaceBlock, SimulationAction, SimulationWorldState } from "./types";

export function createInitialWorldState(): SimulationWorldState {
  return {
    simulatedDays: 0,
    completedActions: [],
    actionCounts: {},
    lastActionAt: null,
  };
}

export function getSimulationActions(demo: ProofOfWorkApiDemoDefinition): SimulationAction[] {
  return demo.actions;
}

export function getSimulationAction(
  demo: ProofOfWorkApiDemoDefinition,
  id: string
): SimulationAction | undefined {
  return demo.actions.find((action) => action.id === id);
}

export function getActionsByCategory(
  demo: ProofOfWorkApiDemoDefinition,
  category: SimulationAction["category"]
): SimulationAction[] {
  return demo.actions.filter((action) => action.category === category);
}

export function isActionRepeatable(action: SimulationAction): boolean {
  return action.repeatable === true || action.kind === "time_simulation";
}

export function hasCompletedAction(state: SimulationWorldState, actionId: string): boolean {
  return (state.actionCounts[actionId] ?? 0) > 0 || state.completedActions.includes(actionId);
}

export function applyMcpSimulationEvent(
  state: SimulationWorldState,
  verb: string
): SimulationWorldState {
  const now = new Date().toISOString();
  const nextCounts = { ...state.actionCounts };
  nextCounts[verb] = (nextCounts[verb] ?? 0) + 1;

  const completedActions = state.completedActions.includes(verb)
    ? state.completedActions
    : [...state.completedActions, verb];

  return {
    ...state,
    completedActions,
    actionCounts: nextCounts,
    lastActionAt: now,
  };
}

export function applySimulationAction(
  state: SimulationWorldState,
  action: SimulationAction
): SimulationWorldState {
  const now = new Date().toISOString();
  const nextCounts = { ...state.actionCounts };
  nextCounts[action.id] = (nextCounts[action.id] ?? 0) + 1;

  const completedActions =
    isActionRepeatable(action) || state.completedActions.includes(action.id)
      ? state.completedActions
      : [...state.completedActions, action.id];

  return {
    simulatedDays: state.simulatedDays + (action.timeDeltaDays ?? 0),
    completedActions,
    actionCounts: nextCounts,
    lastActionAt: now,
  };
}

export function countDistinctProofOfWorkActions(
  demo: ProofOfWorkApiDemoDefinition,
  state: SimulationWorldState
): number {
  return demo.actions.filter(
    (action) => action.kind === "proof_of_work" && hasCompletedAction(state, action.id)
  ).length;
}

export function totalActionCount(state: SimulationWorldState): number {
  return Object.values(state.actionCounts).reduce((sum, count) => sum + count, 0);
}

export function matchBlockToStep(blocks: DemoWorkspaceBlock[], action: SimulationAction): string | null {
  const hint = action.blockHint.toLowerCase();
  const label = action.label.toLowerCase();

  const scored = blocks
    .map((block) => {
      const title = (block.title || "").toLowerCase();
      const description = (block.description || "").toLowerCase();
      let score = 0;
      if (title.includes(hint) || hint.includes(title)) score += 3;
      if (title.includes(label) || label.includes(title)) score += 2;
      if (description.includes(hint) || description.includes(label)) score += 1;
      const hintWords = hint.split(/\s+/).filter((word) => word.length > 3);
      for (const word of hintWords) {
        if (title.includes(word) || description.includes(word)) score += 1;
      }
      return { id: block.id, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored[0]?.id ?? blocks[0]?.id ?? null;
}

export function buildSimulationProofOfWorkPayload(
  demo: ProofOfWorkApiDemoDefinition,
  action: SimulationAction,
  meta: {
    sessionId: string;
    blockId?: string | null;
    worldState: SimulationWorldState;
    reflection?: string;
    outcome?: "success" | "partial" | "struggle" | "failure";
    extra?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const now = new Date().toISOString();
  const count = meta.worldState.actionCounts[action.id] ?? 0;

  if (action.kind === "time_simulation") {
    const elapsedDays = meta.worldState.simulatedDays + (action.timeDeltaDays ?? 0);
    return {
      schema_version: demo.schemaVersion,
      product: demo.productName,
      integration: demo.integrationName,
      session_id: meta.sessionId,
      block_id: meta.blockId || null,
      event: {
        verb: "time_gap_elapsed",
        label: action.label,
        timestamp: now,
        tool_name: demo.simulatorToolName,
        tool_action: action.id,
      },
      time_gap: {
        days_elapsed: action.timeDeltaDays ?? 0,
        total_elapsed_days: elapsedDays,
        occurrence: count + 1,
        reason: "Calendar idle time between learner sessions.",
      },
      learner_reflection:
        meta.reflection ||
        `Recorded ${action.timeDeltaDays ?? 0} day(s) of idle time before the next product activity.`,
      goals: ["time_gap_modeling", "re_engagement_signal"],
      outcome: "partial",
      dimension: action.dimension,
      world_state: {
        elapsed_days: elapsedDays,
        prior_actions: meta.worldState.completedActions,
        action_counts: meta.worldState.actionCounts,
      },
      ...meta.extra,
    };
  }

  return {
    schema_version: demo.schemaVersion,
    product: demo.productName,
    integration: demo.integrationName,
    session_id: meta.sessionId,
    block_id: meta.blockId || null,
    event: {
      verb: action.id,
      label: action.label,
      timestamp: now,
      tool_name: demo.toolName,
      tool_action: action.id,
      category: action.category,
      dimension: action.dimension,
      occurrence: count + 1,
    },
    learner_reflection:
      meta.reflection ||
      `User completed "${action.label}" in ${demo.productName}.`,
    goals: demo.proofOfWorkGoals,
    outcome: meta.outcome || action.outcome || "success",
    block_hint: action.blockHint,
    world_state: {
      elapsed_days: meta.worldState.simulatedDays,
      completed_actions: meta.worldState.completedActions,
      action_counts: meta.worldState.actionCounts,
    },
    ...meta.extra,
  };
}

export function buildMcpEventProofOfWorkPayload(
  demo: ProofOfWorkApiDemoDefinition,
  event: {
    verb: string;
    label: string;
    description: string;
    timestamp: string;
    mcpTool: string;
    outcome?: "success" | "partial" | "struggle" | "failure";
    sourceData: Record<string, unknown>;
  },
  meta: {
    sessionId: string;
    blockId?: string | null;
    worldState: SimulationWorldState;
    extra?: Record<string, unknown>;
  }
): Record<string, unknown> {
  const count = meta.worldState.actionCounts[event.verb] ?? 0;

  return {
    schema_version: demo.schemaVersion,
    product: demo.productName,
    integration: demo.integrationName,
    session_id: meta.sessionId,
    block_id: meta.blockId || null,
    event: {
      verb: event.verb,
      label: event.label,
      timestamp: event.timestamp,
      tool_name: event.mcpTool,
      tool_action: event.verb,
      source: "mcp_simulation",
      occurrence: count + 1,
    },
    learner_reflection: event.description,
    goals: demo.proofOfWorkGoals,
    outcome: event.outcome || "success",
    mcp_import: {
      tool: event.mcpTool,
      source_record: event.sourceData,
    },
    world_state: {
      elapsed_days: meta.worldState.simulatedDays,
      completed_actions: meta.worldState.completedActions,
      action_counts: meta.worldState.actionCounts,
    },
    ...meta.extra,
  };
}

export function shouldSuggestSkillRegeneration(
  proofOfWorkCount: number,
  previousProofOfWorkCount: number | null
): boolean {
  if (proofOfWorkCount === 0) return false;
  if (previousProofOfWorkCount == null) return proofOfWorkCount >= 3;
  const thresholds = [3, 5, 8, 12, 20];
  return thresholds.some(
    (threshold) => proofOfWorkCount >= threshold && previousProofOfWorkCount < threshold
  );
}