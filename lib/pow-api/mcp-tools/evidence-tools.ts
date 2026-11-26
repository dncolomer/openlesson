/**
 * MCP tools/list catalog — 1:1 with AGENT_TOOL_SURFACE (protocol management).
 */

import { AGENT_TOOL_SURFACE } from "../agent-tool-surface";
import {
  FLOW_FILES_API_PATH,
  FLOW_UNSYS_SEED_API_PATH,
  KNOWLEDGE_REGION_API_BASE,
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
      "From files source, or Unsys context on a written challenge. Pass xai_file_id from upload_protocol_file, or inline base64 data. As the challenge source, a new statement is generated when a learner opens.",
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
    description: `Upload a Protocol Challenge context file (PDF, text, image). REST: POST ${FLOW_FILES_API_PATH}. Pass the returned xai_file_id in create_protocol / update_protocol artifacts.`,
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
