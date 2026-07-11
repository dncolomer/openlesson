/**
 * Backward-compatible re-exports for the FlowStack demo and shared simulation toolkit.
 * New demos live under ./demos/ — use getDemoById() for multi-demo support.
 */
import { getDemoWorkspaceModelFile as getModelFile } from "./demo-definition";
import { nexusfrontDemo } from "./demos/nexusfront";
import {
  applySimulationAction,
  buildSimulationProofOfWorkPayload as buildPayload,
  countDistinctProofOfWorkActions as countDistinct,
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

const legacyDemo = nexusfrontDemo;

export const DEMO_PRODUCT_NAME = legacyDemo.productName;
export const DEMO_INTEGRATION_NAME = legacyDemo.integrationName;
export const DEMO_EVAL_DEFINITION = legacyDemo.evalDefinition;
export const DEMO_WORKSPACE_MODEL_DOC = legacyDemo.modelDoc;
export const DEMO_WORKSPACE_PROMPT = legacyDemo.workspacePrompt;

export const SIMULATION_CATEGORY_META = legacyDemo.categoryMeta;
export const SIMULATION_ACTIONS = legacyDemo.actions;
export const SIMULATION_CATEGORY_ORDER = legacyDemo.categoryOrder;

/** @deprecated Use SIMULATION_ACTIONS */
export const FLOWSTACK_STEPS = SIMULATION_ACTIONS.filter((action) => action.kind === "proof_of_work");
export type FlowStackStep = SimulationAction;

export {
  createInitialWorldState,
  applySimulationAction,
  matchBlockToStep,
  shouldSuggestSkillRegeneration,
  totalActionCount,
};

export function getActionsByCategory(category: import("./types").SimulationCategory) {
  return getActionsByCategoryForDemo(legacyDemo, category);
}

export function getSimulationAction(id: string) {
  return getSimulationActionForDemo(legacyDemo, id);
}

export function getDemoWorkspaceModelFile() {
  return getModelFile(legacyDemo);
}

export function countDistinctProofOfWorkActions(state: SimulationWorldState) {
  return countDistinct(legacyDemo, state);
}

export function buildSimulationProofOfWorkPayload(
  action: SimulationAction,
  meta: Parameters<typeof buildPayload>[2]
) {
  return buildPayload(legacyDemo, action, meta);
}

/** @deprecated Use buildSimulationProofOfWorkPayload */
export function buildToolProofOfWorkPayload(
  step: SimulationAction,
  meta: {
    sessionId: string;
    blockId?: string | null;
    reflection?: string;
    outcome?: "success" | "partial" | "struggle" | "failure";
    extra?: Record<string, unknown>;
  }
) {
  return buildPayload(legacyDemo, step, {
    ...meta,
    worldState: createInitialWorldState(),
  });
}

import type { SimulationAction, SimulationWorldState } from "./types";