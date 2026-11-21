/**
 * MCP tools/list catalog — 1:1 with AGENT_TOOL_SURFACE (flow management).
 */

import { AGENT_TOOL_SURFACE } from "../agent-tool-surface";
import {
  FLOW_API_BASE,
  FLOW_FILES_API_PATH,
  FLOW_UNSYS_SEED_API_PATH,
  KNOWLEDGE_REGION_API_BASE,
} from "@/lib/api/agent-api-paths";
import { FLOW_CHANNEL_IDS } from "@/lib/flow-channels";
import { FLOW_AUTHORING_CREATE_SPEC } from "@/lib/flow-authoring-spec";

const CATALOG_SIZE_ENUM = [4, 8, 16] as const;
const PRODUCT_FLOW_KIND_ENUM = ["solve", "calibration", "verification"] as const;

const ARTIFACT_ITEM_SCHEMA = {
  type: "object",
  properties: {
    name: { type: "string" },
    mime_type: { type: "string" },
    mimeType: { type: "string" },
    xai_file_id: { type: "string" },
    xaiFileId: { type: "string" },
    file_id: { type: "string" },
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
    "Solve / Verification: channels the run requires (audio, muse, video, screenshots). Calibration ignores this and stores all-off.",
  properties: Object.fromEntries(FLOW_CHANNEL_IDS.map((id) => [id, { type: "boolean" }])),
  additionalProperties: false,
};

const FLOW_WRITE_PROPERTIES = {
  name: { type: "string" },
  topic: {
    type: "string",
    description:
      "Written problem source. Required unless artifacts/files (problem generated when a learner opens) or opening_canvas_scene on Solve/Verification. Calibration stores the same string as goal.",
  },
  goal: { type: "string" },
  problem: { type: "string" },
  questions: { type: "array", items: { type: "string" } },
  duration_minutes: {
    type: "number",
    description: "Verification and Calibration run countdown. Solve has no public countdown control.",
  },
  action_catalog: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
  artifacts: {
    type: "array",
    description:
      "From files source, or Unsys context on a written problem. Pass xai_file_id from upload_flow_file, or inline base64 data. As the problem source, a new statement is generated when a learner opens.",
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
      "Solve / Verification, written problem source only. Puts topic on the Work canvas as written. Ignored when artifacts are the problem source, with opening_canvas_scene, or for Calibration. Default false.",
  },
  generate_problem_on_open: {
    type: "boolean",
    description:
      "From files source. Implied true when artifacts are the problem: a new statement is generated when a learner opens. Topic may be empty. Ignored when opening_canvas_scene is set.",
  },
  opening_canvas_scene: {
    type: "object",
    description:
      "Prepared board source (Solve / Verification). The Work canvas is the problem. Ignored for Calibration. Takes priority over generate_problem_on_open and exact_problem_on_canvas.",
  },
  answers_model_seed: {
    type: ["object", "string"],
    description:
      "Custom uncertainty model for this flow. Canonical { model } with priced parent→child edges, or a generic tree spec: nested { title, children, weight }, or { nodes, edges } with weight/price. JSON string accepted. Same as uncertainty_model.",
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
      "Generate an Unsys seed from the Problem and artifacts when answers_model_seed is omitted.",
  },
  unsys_guidance: {
    type: "string",
    description: "Optional prompt used when generate_unsys is true.",
  },
  enforced_channels: ENFORCED_CHANNELS_SCHEMA,
  workspace_id: { type: "string" },
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

const SCHEMAS: Record<string, Omit<McpTool, "name">> = {
  list_flows: {
    description: `List Solve, Calibration, and Verification flows owned by this key. REST: GET ${FLOW_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [...PRODUCT_FLOW_KIND_ENUM],
        },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  create_flow: {
    description: `Create a Solve, Calibration, or Verification flow (same Author sources as the dashboard wizard). REST: POST ${FLOW_API_BASE}. ${FLOW_AUTHORING_CREATE_SPEC}`,
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [...PRODUCT_FLOW_KIND_ENUM],
          description: "solve | calibration | verification",
        },
        ...FLOW_WRITE_PROPERTIES,
      },
      required: ["kind"],
      additionalProperties: false,
    },
  },
  upload_flow_file: {
    description: `Upload a Problem-context file (PDF, text, image). REST: POST ${FLOW_FILES_API_PATH}. Pass the returned xai_file_id in create_flow / update_flow artifacts.`,
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
  generate_flow_unsys_seed: {
    description: `Generate the Unsys model from the Problem, artifacts, and optional guidance (wizard model step). REST: POST ${FLOW_UNSYS_SEED_API_PATH}. Pass answers_model_seed into create_flow / update_flow.`,
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: [...PRODUCT_FLOW_KIND_ENUM],
        },
        name: { type: "string" },
        topic: { type: "string" },
        goal: { type: "string" },
        problem: { type: "string" },
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
  get_flow: {
    description: `Read one flow. REST: GET ${FLOW_API_BASE}/{flow_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        flow_id: { type: "string" },
      },
      required: ["flow_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_flow: {
    description: `Update a Solve, Calibration, or Verification flow (same Author sources as create_flow). REST: PATCH ${FLOW_API_BASE}/{flow_id}. ${FLOW_AUTHORING_CREATE_SPEC}`,
    inputSchema: {
      type: "object",
      properties: {
        flow_id: { type: "string" },
        ...FLOW_WRITE_PROPERTIES,
      },
      required: ["flow_id"],
      additionalProperties: false,
    },
  },
  delete_flow: {
    description: `Delete a Solve, Calibration, or Verification flow. REST: DELETE ${FLOW_API_BASE}/{flow_id}.`,
    inputSchema: {
      type: "object",
      properties: { flow_id: { type: "string" } },
      required: ["flow_id"],
      additionalProperties: false,
    },
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
          description: "Named mix of basis channels, default path. Example: path+audio.",
        },
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
  return {
    name: tool.name,
    description: schema.description,
    inputSchema: schema.inputSchema,
    ...(schema.annotations ? { annotations: schema.annotations } : {}),
  };
});
