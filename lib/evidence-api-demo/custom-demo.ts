import {
  buildModelDoc,
  createTimeToolActions,
  type EvidenceApiDemoDefinition,
  STANDARD_CATEGORY_ORDER,
} from "./demo-definition";
import type { SimulationAction, SimulationCategory } from "./types";

export const CUSTOM_DEMO_ID = "custom";

const EVIDENCE_CATEGORIES = STANDARD_CATEGORY_ORDER.filter(
  (c): c is Exclude<SimulationCategory, "simulation_tools"> => c !== "simulation_tools"
);

const DEFAULT_CATEGORY_META: EvidenceApiDemoDefinition["categoryMeta"] = {
  onboarding: { label: "Onboarding", description: "Initial setup and enrollment steps." },
  integrations: { label: "Integrations", description: "External systems, feeds, and connectors." },
  projects: { label: "Projects & workflows", description: "Core workstreams and deliverables." },
  team: { label: "Team & review", description: "Collaboration, handoffs, and approvals." },
  activation: { label: "Activation", description: "Milestones, sign-off, and readiness signals." },
  support: { label: "Guidance", description: "Playbooks, training, and help touchpoints." },
  edge_cases: { label: "Exceptions", description: "Mistakes, abandonment, and recovery paths." },
  simulation_tools: {
    label: "Calendar gaps",
    description: "Record idle time between sessions when calendar gaps matter.",
  },
};

export const CUSTOM_DEMO_PICKER: EvidenceApiDemoDefinition = {
  id: CUSTOM_DEMO_ID,
  productName: "Custom",
  integrationName: "custom-partner-agent",
  useCase: "Custom verification scenario",
  tagline: "Paste your own prompt",
  saasCategory: "Configurable",
  description:
    "Describe any product workflow — OpenLesson generates event actions and a verification workspace from your prompt. Calendar gap tools are always included.",
  scenarioTitle: "Custom scenario",
  scenarioIntro: "Define the learner journey you want to verify.",
  workspaceDescription: "Custom learning verification program",
  initials: "CU",
  accent: "indigo",
  evalDefinition: "",
  workspacePrompt: "",
  modelDocFilename: "custom-eval-model.md",
  modelDoc: "",
  toolName: "custom_product",
  simulatorToolName: "custom_product_events",
  schemaVersion: "custom_evidence_v1",
  evidenceGoals: ["custom_verification"],
  integrationHints: {
    event_verbs: ["time_gap_elapsed"],
    goals: ["custom_verification"],
  },
  partnerDescription: "Custom partner integration that emits product events and uploads evidence to OpenLesson.",
  integrationSkillContext: "Custom verification integration generated from operator prompt",
  categoryMeta: DEFAULT_CATEGORY_META,
  categoryOrder: ["simulation_tools"],
  actions: createTimeToolActions(),
};

export interface GeneratedSimulationAction {
  id: string;
  label: string;
  description: string;
  block_hint: string;
  cta: string;
  dimension: string;
  outcome?: SimulationAction["outcome"];
  repeatable?: boolean;
}

export interface GeneratedSimulationCategory {
  category: SimulationCategory;
  label: string;
  description: string;
  actions: GeneratedSimulationAction[];
}

export interface GeneratedSimulationSpec {
  product_name: string;
  tagline: string;
  saas_category: string;
  use_case: string;
  scenario_title: string;
  scenario_intro: string;
  eval_definition: string;
  integration_name: string;
  tool_name: string;
  competency_rows: string;
  categories: GeneratedSimulationCategory[];
}

function slugifyActionId(value: string, index: number): string {
  const slug = value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 48);
  return slug || `action_${index + 1}`;
}

function normalizeCategory(value: string): SimulationCategory | null {
  return (EVIDENCE_CATEGORIES as readonly string[]).includes(value)
    ? (value as SimulationCategory)
    : null;
}

export function buildCustomDemoDefinition(
  spec: GeneratedSimulationSpec,
  userPrompt: string
): EvidenceApiDemoDefinition {
  const categoryMeta = { ...DEFAULT_CATEGORY_META };
  const actions: SimulationAction[] = [];
  const categoryOrder: SimulationCategory[] = [];
  const eventVerbs = new Set<string>(["time_gap_elapsed"]);
  const usedIds = new Set<string>();

  for (const [index, group] of spec.categories.entries()) {
    const category = normalizeCategory(group.category);
    if (!category) continue;

    categoryMeta[category] = {
      label: group.label.trim() || categoryMeta[category].label,
      description: group.description.trim() || categoryMeta[category].description,
    };

    if (!categoryOrder.includes(category)) {
      categoryOrder.push(category);
    }

    for (const [actionIndex, raw] of group.actions.entries()) {
      const baseId = slugifyActionId(raw.id || raw.label, index * 20 + actionIndex);
      let id = baseId;
      let suffix = 2;
      while (usedIds.has(id)) {
        id = `${baseId}_${suffix}`;
        suffix += 1;
      }
      usedIds.add(id);
      eventVerbs.add(id);

      actions.push({
        id,
        label: raw.label.trim(),
        description: raw.description.trim(),
        category,
        blockHint: raw.block_hint.trim() || raw.label.trim(),
        cta: raw.cta.trim() || "Complete",
        kind: "evidence",
        repeatable: raw.repeatable === true,
        dimension: raw.dimension.trim() || category,
        outcome: raw.outcome ?? "success",
      });
    }
  }

  const timeTools = createTimeToolActions();
  actions.push(...timeTools);
  categoryOrder.push("simulation_tools");

  const productName = spec.product_name.trim() || "Custom Product";
  const integrationName = spec.integration_name.trim() || "custom-partner-agent";
  const toolName = spec.tool_name.trim() || "custom_product";
  const evalDefinition =
    spec.eval_definition.trim() ||
    `Verify competency for the workflow described in the operator prompt:\n${userPrompt.trim()}`;

  const workspacePrompt = `Learning verification for ${productName}.

Operator scenario:
"""
${userPrompt.trim()}
"""

Learners may take non-linear paths, hit friction, recover from mistakes, and return after idle gaps.
Create assessable blocks aligned to the competency dimensions in the evaluation model.
Verify readiness across the full workflow — not a single linear checklist.`;

  const modelDoc = buildModelDoc(
    {
      productName,
      integrationName,
      evalDefinition,
      modelDocFilename: "custom-eval-model.md",
      useCase: spec.use_case.trim() || "Custom verification",
      scenarioIntro: spec.scenario_intro.trim() || userPrompt.trim().slice(0, 400),
    },
    spec.competency_rows.trim() ||
      "| workflow_execution | Completes core steps with consistent tool traces |\n| decision_quality | Makes justified choices under realistic constraints |\n| recovery | Detects and repairs mistakes or misconfiguration |\n| reflection | Articulates rationale in learner reflections |"
  );

  return {
    id: CUSTOM_DEMO_ID,
    productName,
    integrationName,
    useCase: spec.use_case.trim() || "Custom verification",
    tagline: spec.tagline.trim() || "Generated from your prompt",
    saasCategory: spec.saas_category.trim() || "Custom",
    description: userPrompt.trim().slice(0, 280),
    scenarioTitle: spec.scenario_title.trim() || "Custom verification flow",
    scenarioIntro: spec.scenario_intro.trim() || userPrompt.trim().slice(0, 400),
    workspaceDescription: `${productName} learning verification`,
    initials: productName
      .split(/\s+/)
      .map((word) => word[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "CU",
    accent: "indigo",
    evalDefinition,
    workspacePrompt,
    modelDocFilename: "custom-eval-model.md",
    modelDoc,
    toolName,
    simulatorToolName: `${toolName}_events`,
    schemaVersion: `${toolName.replace(/[^a-z0-9]+/gi, "_").toLowerCase()}_evidence_v1`,
    evidenceGoals: ["custom_verification", "workflow_readiness"],
    integrationHints: {
      event_verbs: Array.from(eventVerbs).slice(0, 12),
      goals: ["custom_verification", "workflow_readiness"],
    },
    partnerDescription: `${productName} partner integration that emits product events and uploads evidence to OpenLesson.`,
    integrationSkillContext: `${productName} custom verification integration`,
    categoryMeta,
    categoryOrder,
    actions,
  };
}

export function parseCustomDefinitionFromBody(
  body: Record<string, unknown>
): EvidenceApiDemoDefinition | null {
  const raw = body.customDefinition ?? body.custom_definition;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;

  const candidate = raw as Partial<EvidenceApiDemoDefinition>;
  if (candidate.id !== CUSTOM_DEMO_ID) return null;
  if (!Array.isArray(candidate.actions) || candidate.actions.length === 0) return null;
  if (!candidate.productName || !candidate.evalDefinition) return null;

  return candidate as EvidenceApiDemoDefinition;
}

export function isCustomDemoId(demoId: string | null | undefined): boolean {
  return demoId === CUSTOM_DEMO_ID;
}