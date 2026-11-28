/**
 * MCP tools/list catalog — 1:1 with AGENT_TOOL_SURFACE (protocol + knowledge-region management).
 */

import { AGENT_TOOL_SURFACE } from "../agent-tool-surface";
import {
  FLOW_FILES_API_PATH,
  FLOW_UNSYS_SEED_API_PATH,
  KNOWLEDGE_REGION_API_BASE,
  KNOWLEDGE_REGION_JOBS_API_PATH,
  KNOWLEDGE_REGION_OPTIONS_API_PATH,
  PROTOCOL_API_BASE,
} from "@/lib/api/agent-api-paths";
import { FLOW_CHANNEL_IDS } from "@/lib/flow-channels";
import { FLOW_AUTHORING_CREATE_SPEC } from "@/lib/flow-authoring-spec";

const CATALOG_SIZE_ENUM = [4, 8, 16] as const;

const ARTIFACT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    mime_type: { type: "string" },
    mimeType: { type: "string" },
    file_id: {
      type: "string",
      description:
        "Opaque BlobStore id from upload_protocol_file. Works with platform files or a custom document store.",
    },
    fileId: { type: "string", description: "Alias of file_id." },
    xai_file_id: { type: "string", description: "Alias of file_id." },
    xaiFileId: { type: "string", description: "Alias of file_id." },
    data: {
      type: "string",
      description: "Base64 file bytes. Uploaded then attached as context.",
    },
  },
  additionalProperties: false,
} as const;

const FILE_UPLOAD_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    mime_type: { type: "string" },
    mimeType: { type: "string" },
    data: { type: "string", description: "Base64 file bytes." },
  },
  required: ["name", "data"],
  additionalProperties: false,
} as const;

const ENFORCED_CHANNELS_SCHEMA = {
  type: "object",
  description:
    "Channels the run requires (audio, muse, video, screenshots).",
  properties: Object.fromEntries(FLOW_CHANNEL_IDS.map((id) => [id, { type: "boolean" }])),
  additionalProperties: false,
};

const PROTOCOL_WRITE_PROPERTIES = {
  name: { type: "string" },
  challenge: {
    type: "string",
    description:
      "The Protocol Challenge. Required unless artifacts/files (challenge generated when a learner opens) or opening_canvas_scene.",
  },
  topic: {
    type: "string",
    description: "Alias of challenge.",
  },
  goal: { type: "string", description: "Alias of challenge." },
  problem: { type: "string", description: "Alias of challenge." },
  questions: { type: "array", items: { type: "string" } },
  duration_minutes: {
    type: "number",
    description: "Run countdown in minutes.",
  },
  action_catalog: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
  artifacts: {
    type: "array",
    description:
      "From files source, or Unsys context on a written challenge. Pass file_id from upload_protocol_file (opaque BlobStore id), or inline base64 data. As the challenge source, a new statement is generated when a learner opens.",
    items: ARTIFACT_ITEM_SCHEMA,
  },
  files: {
    type: "array",
    description: "Inline base64 uploads attached as artifacts (same as the wizard file picker).",
    items: FILE_UPLOAD_ITEM_SCHEMA,
  },
  exact_problem_on_canvas: {
    type: "boolean",
    description:
      "Written Protocol Challenge source only (written problem source only). Puts challenge on the Work canvas as written. Ignored when artifacts are the challenge source or with opening_canvas_scene. Default false.",
  },
  generate_problem_on_open: {
    type: "boolean",
    description:
      "From files source. Implied true when artifacts are the challenge: a new statement is generated when a learner opens. Challenge may be empty. Ignored when opening_canvas_scene is set.",
  },
  opening_canvas_scene: {
    type: "object",
    description:
      "Prepared board source. The Work canvas is the challenge. Takes priority over generate_problem_on_open and exact_problem_on_canvas.",
  },
  answers_model_seed: {
    type: ["object", "string"],
    description:
      "Custom uncertainty model for this protocol. Canonical { model } with priced parent→child edges, or a generic tree spec: nested { title, children, weight }, or { nodes, edges } with weight/price. JSON string accepted. Same as uncertainty_model.",
  },
  uncertainty_model: {
    type: ["object", "string"],
    description:
      "Alias of answers_model_seed. Generic tree with weights (nodes/edges or nested children) or serialized JSON.",
  },
  unsys_model: {
    type: ["object", "string"],
    description: "Alias of answers_model_seed.",
  },
  generate_unsys: {
    type: "boolean",
    description:
      "Generate an Unsys seed from The Protocol Challenge and artifacts when answers_model_seed is omitted.",
  },
  unsys_guidance: {
    type: "string",
    description: "Optional prompt used when generate_unsys is true.",
  },
  enforced_channels: ENFORCED_CHANNELS_SCHEMA,
  protocol_setting_id: {
    type: "string",
    description:
      "Named protocol canvas setting from GET /api/v3/protocol-settings. Omit or pass empty/default to use the organization default.",
  },
  canvas_capture: {
    type: "object",
    description:
      "Store mermaid documents of the Work canvas every N actions. Default off. Documents land on the stored record, never in the embedding.",
    properties: {
      enabled: { type: "boolean" },
      every_actions: { type: "integer", minimum: 2, maximum: 48 },
      everyActions: { type: "integer", minimum: 2, maximum: 48 },
    },
    additionalProperties: false,
  },
  workspace_id: { type: "string" },
} as const;

const CUSTOM_STRATEGY_SCHEMA = {
  type: "object",
  properties: {
    id: { type: "string" },
    name: {
      type: "string",
      description: "Optional display name. Derived from prompt when omitted.",
    },
    instructions: { type: "string", description: "Exploration prompt. Alias of prompt." },
    prompt: {
      type: "string",
      description:
        "Exploration prompt. Enough on its own: { prompt } or a string item. Alias of instructions.",
    },
    description: { type: "string" },
  },
  additionalProperties: false,
} as const;

const CUSTOM_STRATEGY_ITEM_SCHEMA = {
  anyOf: [
    {
      type: "string",
      description: "Prompt-only custom strategy. Name is derived from the prompt.",
    },
    CUSTOM_STRATEGY_SCHEMA,
  ],
} as const;

const KNOWLEDGE_REGION_SIMULATION_PROPERTIES = {
  protocol_ids: {
    type: "array",
    items: { type: "string" },
    description: "Protocol ids from get_knowledge_region_options. Alias protocolIds.",
  },
  protocolIds: { type: "array", items: { type: "string" } },
  strategy_ids: {
    type: "array",
    items: { type: "string" },
    description:
      "Built-in exploration strategy ids: exploit-heavy, information-seeking, novelty-seeking, balanced, narrow-and-deep. Custom strategies from custom_strategies are included even when their generated ids are omitted here. Alias strategyIds.",
  },
  strategyIds: { type: "array", items: { type: "string" } },
  custom_strategies: {
    type: "array",
    items: CUSTOM_STRATEGY_ITEM_SCHEMA,
    description:
      "Custom exploration strategies. Pass a prompt string, { prompt }, or { name, prompt }. Included in the run even if strategy_ids omits the generated custom id. Alias customStrategies.",
  },
  customStrategies: { type: "array", items: CUSTOM_STRATEGY_ITEM_SCHEMA },
  samples_per_strategy: {
    type: "integer",
    description: "Samples per exploration strategy (3–48, default 12). Alias samplesPerStrategy.",
  },
  samplesPerStrategy: { type: "integer" },
  include_human_data: {
    type: "boolean",
    description: "Overlay real protocol sessions on the simulated region. Alias includeHumanData.",
  },
  includeHumanData: { type: "boolean" },
  ai_use_catalog_ids: {
    type: "array",
    items: { type: "string" },
    description:
      "AI-use catalog ids from get_knowledge_region_options (requires an org OpenRouter key). Alias aiUseCatalogIds.",
  },
  aiUseCatalogIds: { type: "array", items: { type: "string" } },
  samples_per_ai_use: {
    type: "integer",
    description: "Samples per AI-use model (3–12, default 6). Alias samplesPerAiUse.",
  },
  samplesPerAiUse: { type: "integer" },
} as const;

type McpTool = {
  name: string;
  description: string;
  inputSchema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: readonly string[];
    additionalProperties: false;
  };
  annotations?: { readOnlyHint: true };
};

const ORGANIZATION_ID_PROPERTIES = {
  organization_id: {
    type: "string",
    description:
      "Organization to target. Required. Users belong to multiple orgs. REST also accepts query organization_id or header X-Organization-Id. Alias organizationId.",
  },
  organizationId: {
    type: "string",
    description: "Alias of organization_id.",
  },
} as const;

function withOrganizationIdSchema(
  schema: Omit<McpTool, "name">,
): Omit<McpTool, "name"> {
  const previous = schema.inputSchema.required ?? [];
  const required = [
    "organization_id",
    ...previous.filter((name) => name !== "organization_id"),
  ];
  return {
    ...schema,
    inputSchema: {
      ...schema.inputSchema,
      properties: {
        ...ORGANIZATION_ID_PROPERTIES,
        ...schema.inputSchema.properties,
      },
      required,
    },
  };
}

const SCHEMAS: Record<string, Omit<McpTool, "name">> = {
  list_protocols: {
    description: `List knowledge verification protocols owned by this key. REST: GET ${PROTOCOL_API_BASE}. Do not send kind.`,
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  create_protocol: {
    description: `Create a knowledge verification protocol (same Author sources as the dashboard wizard). REST: POST ${PROTOCOL_API_BASE}. ${FLOW_AUTHORING_CREATE_SPEC}`,
    inputSchema: {
      type: "object",
      properties: {
        ...PROTOCOL_WRITE_PROPERTIES,
      },
      additionalProperties: false,
    },
  },
  upload_protocol_file: {
    description: `Upload a Protocol Challenge context file (PDF, text, image). REST: POST ${FLOW_FILES_API_PATH}. Pass the returned file_id in create_protocol / update_protocol artifacts.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        file_name: { type: "string" },
        mime_type: { type: "string" },
        data: { type: "string", description: "Base64 file bytes." },
        workspace_id: { type: "string" },
      },
      required: ["data"],
      additionalProperties: false,
    },
  },
  generate_protocol_unsys_seed: {
    description: `Generate the Unsys model from The Protocol Challenge, artifacts, and optional guidance (wizard model step). REST: POST ${FLOW_UNSYS_SEED_API_PATH}. Pass answers_model_seed into create_protocol / update_protocol.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string" },
        challenge: { type: "string" },
        topic: { type: "string", description: "Alias of challenge." },
        goal: { type: "string", description: "Alias of challenge." },
        problem: { type: "string", description: "Alias of challenge." },
        artifacts: { type: "array", items: ARTIFACT_ITEM_SCHEMA },
        guidance: { type: "string" },
        prompt: { type: "string" },
        unsys_guidance: { type: "string" },
        parent_id: { type: "string" },
        seed_model: { type: "object" },
        model: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  get_protocol: {
    description: `Read one knowledge verification protocol. REST: GET ${PROTOCOL_API_BASE}/{protocol_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        protocol_id: { type: "string" },
      },
      required: ["protocol_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_protocol_url: {
    description: `Public launch URL for a protocol. Pass identity (or id) to prepopulate the participant ID so the flow does not ask for it. REST: GET ${PROTOCOL_API_BASE}/{protocol_id}/url.`,
    inputSchema: {
      type: "object",
      properties: {
        protocol_id: { type: "string" },
        identity: {
          type: "string",
          description: "Participant ID to put on the URL. Omit for a URL that asks for identity.",
        },
        id: { type: "string", description: "Alias of identity." },
        candidate_id: { type: "string", description: "Alias of identity." },
      },
      required: ["protocol_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_protocol: {
    description: `Update a knowledge verification protocol (same Author sources as create_protocol). REST: PATCH ${PROTOCOL_API_BASE}/{protocol_id}. ${FLOW_AUTHORING_CREATE_SPEC}`,
    inputSchema: {
      type: "object",
      properties: {
        protocol_id: { type: "string" },
        ...PROTOCOL_WRITE_PROPERTIES,
      },
      required: ["protocol_id"],
      additionalProperties: false,
    },
  },
  delete_protocol: {
    description: `Delete a knowledge verification protocol. REST: DELETE ${PROTOCOL_API_BASE}/{protocol_id}.`,
    inputSchema: {
      type: "object",
      properties: { protocol_id: { type: "string" } },
      required: ["protocol_id"],
      additionalProperties: false,
    },
  },
  list_knowledge_regions: {
    description: `List knowledge regions in the active organization. REST: GET ${KNOWLEDGE_REGION_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_knowledge_region_options: {
    description: `Wizard options for knowledge-region create: protocols, exploration strategies, AI-use catalog, sample bounds. REST: GET ${KNOWLEDGE_REGION_OPTIONS_API_PATH}.`,
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  create_knowledge_region: {
    description: `Create a knowledge region by running the simulation wizard (same options as /regions/new). REST: POST ${KNOWLEDGE_REGION_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
        name: { type: "string", description: "Knowledge region name." },
        ...KNOWLEDGE_REGION_SIMULATION_PROPERTIES,
      },
      required: ["name"],
      additionalProperties: false,
    },
  },
  get_knowledge_region: {
    description: `Read one knowledge region with clusters, strategies, AI-use clusters, and samples (no vectors). REST: GET ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
      },
      required: ["knowledge_region_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_knowledge_region: {
    description: `Rename a knowledge region. REST: PATCH ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
        name: { type: "string" },
      },
      required: ["knowledge_region_id", "name"],
      additionalProperties: false,
    },
  },
  delete_knowledge_region: {
    description: `Delete a knowledge region and its simulation clusters. REST: DELETE ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
      },
      required: ["knowledge_region_id"],
      additionalProperties: false,
    },
  },
  simulate_knowledge_region: {
    description: `Add exploration-strategy or AI-use samples to an existing knowledge region. REST: POST ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}/simulation.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
        ...KNOWLEDGE_REGION_SIMULATION_PROPERTIES,
      },
      required: ["knowledge_region_id"],
      additionalProperties: false,
    },
  },
  get_knowledge_region_job: {
    description: `Read a knowledge-region simulation job. REST: GET ${KNOWLEDGE_REGION_JOBS_API_PATH}/{job_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        job_id: { type: "string" },
      },
      required: ["job_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_knowledge_region_run: {
    description: `Retrieve stored proof-of-work for one sample run (no person audio or video). REST: GET ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}/runs/{run_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
        run_id: { type: "string" },
      },
      required: ["knowledge_region_id", "run_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_knowledge_region_candidate: {
    description: `Render one candidate in a knowledge region (unsys distance, cluster L2, pairwise L2). REST: GET ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}/candidates/{candidate_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
        candidate_id: { type: "string" },
        space: {
          type: "string",
          description: "Embedding space. This client reads Path (flowcfg-v1-d96) only.",
        },
      },
      required: ["knowledge_region_id", "candidate_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_knowledge_region_uncertainty_model: {
    description: `Overlay one candidate walk on the region’s reference uncertainty model. REST: GET ${KNOWLEDGE_REGION_API_BASE}/{knowledge_region_id}/candidates/{candidate_id}/uncertainty-model.`,
    inputSchema: {
      type: "object",
      properties: {
        knowledge_region_id: { type: "string" },
        candidate_id: { type: "string" },
        run_id: { type: "string" },
        runId: { type: "string" },
      },
      required: ["knowledge_region_id", "candidate_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
};

export const MCP_EVIDENCE_TOOLS = AGENT_TOOL_SURFACE.map((tool) => {
  const schema = SCHEMAS[tool.name];
  if (!schema) {
    throw new Error(`Missing MCP schema for ${tool.name}`);
  }
  const withOrg = withOrganizationIdSchema(schema);
  return {
    name: tool.name,
    description: withOrg.description,
    inputSchema: withOrg.inputSchema,
    ...(withOrg.annotations ? { annotations: withOrg.annotations } : {}),
  };
});
