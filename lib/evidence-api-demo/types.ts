export type SimulationCategory =
  | "onboarding"
  | "integrations"
  | "projects"
  | "team"
  | "activation"
  | "support"
  | "edge_cases"
  | "simulation_tools";

export type SimulationActionKind = "evidence" | "time_simulation";

export type SimulationActionId = string;

export interface SimulationAction {
  id: SimulationActionId;
  label: string;
  description: string;
  category: SimulationCategory;
  blockHint: string;
  cta: string;
  kind: SimulationActionKind;
  repeatable?: boolean;
  suggestedAfter?: SimulationActionId[];
  timeDeltaDays?: number;
  outcome?: "success" | "partial" | "struggle" | "failure";
  dimension: string;
}

export interface DemoWorkspaceBlock {
  id: string;
  title: string;
  description?: string | null;
}

export interface SimulationWorldState {
  simulatedDays: number;
  completedActions: string[];
  actionCounts: Record<string, number>;
  lastActionAt: string | null;
}