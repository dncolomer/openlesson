/**
 * Backward-compatible re-exports for the FlowStack demo and shared simulation toolkit.
 * New demos live under ./demos/ — use getDemoById() for multi-demo support.
 */
import { getDemoWorkspaceModelFile as getModelFile } from "./demo-definition";
import { flowstackDemo } from "./demos/flowstack";
import {
  applySimulationAction,
  buildSimulationEvidencePayload as buildPayload,
  countDistinctEvidenceActions as countDistinct,
  createInitialWorldState,
  getActionsByCategory as getActionsByCategoryForDemo,
  getSimulationAction as getSimulationActionForDemo,
  matchBlockToStep,
  shouldSuggestSkillRegeneration,
  totalActionCount,
} from "./simulation";

export type {
  DemoWorkspaceBlock,
  SimulationAction,
  SimulationActionId,
  SimulationActionKind,
  SimulationCategory,
  SimulationWorldState,
} from "./types";

export const DEMO_PRODUCT_NAME = flowstackDemo.productName;
export const DEMO_INTEGRATION_NAME = flowstackDemo.integrationName;
export const DEMO_EVAL_DEFINITION = flowstackDemo.evalDefinition;
export const DEMO_WORKSPACE_MODEL_DOC = flowstackDemo.modelDoc;
export const DEMO_WORKSPACE_PROMPT = flowstackDemo.workspacePrompt;

export const SIMULATION_CATEGORY_META = flowstackDemo.categoryMeta;
export const SIMULATION_ACTIONS = flowstackDemo.actions;
export const SIMULATION_CATEGORY_ORDER = flowstackDemo.categoryOrder;

/** @deprecated Use SIMULATION_ACTIONS */
export const FLOWSTACK_STEPS = SIMULATION_ACTIONS.filter((action) => action.kind === "evidence");
export type FlowStackStep = SimulationAction;

export {
  createInitialWorldState,
  applySimulationAction,
  matchBlockToStep,
  shouldSuggestSkillRegeneration,
  totalActionCount,
};

export function getActionsByCategory(category: import("./types").SimulationCategory) {
  return getActionsByCategoryForDemo(flowstackDemo, category);
}

export function getSimulationAction(id: string) {
  return getSimulationActionForDemo(flowstackDemo, id);
}

export function getDemoWorkspaceModelFile() {
  return getModelFile(flowstackDemo);
}

export function countDistinctEvidenceActions(state: SimulationWorldState) {
  return countDistinct(flowstackDemo, state);
}

export function buildSimulationEvidencePayload(
  action: SimulationAction,
  meta: Parameters<typeof buildPayload>[2]
) {
  return buildPayload(flowstackDemo, action, meta);
}

/** @deprecated Use buildSimulationEvidencePayload */
export function buildToolEvidencePayload(
  step: SimulationAction,
  meta: {
    sessionId: string;
    blockId?: string | null;
    reflection?: string;
    outcome?: "success" | "partial" | "struggle" | "failure";
    extra?: Record<string, unknown>;
  }
) {
  return buildPayload(flowstackDemo, step, {
    ...meta,
    worldState: createInitialWorldState(),
  });
}

import type { SimulationAction, SimulationWorldState } from "./types";