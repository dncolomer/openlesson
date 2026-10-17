/**
 * MCP tools/list catalog — 1:1 with AGENT_TOOL_SURFACE (workspace + headless PoW).
 */

import { POW_MODEL_VERSION, WORKSPACE_PROOF_OF_WORK_WIRE_TYPES } from "../workspace-proof-of-work";
import {
  powModelAgentSimulationContract,
  powModelVersionFieldDescription,
} from "../pow-model-agent-contract";
import { AGENT_TOOL_SURFACE } from "../agent-tool-surface";
import { WORKSPACE_API_BASE, POW_API_BASE, ACCOUNT_API_BASE } from "@/lib/api/agent-api-paths";

const POW_MODEL_VERSION_FIELD = {
  type: "string" as const,
  enum: [POW_MODEL_VERSION],
  description: powModelVersionFieldDescription(),
};

const FLOW_KIND_ENUM = ["calibrate", "learn", "verify", "tapbench"] as const;
const CATALOG_SIZE_ENUM = [4, 8, 16] as const;

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
  list_workspaces: {
    description: `List Learning and Verification workspaces. REST: GET ${WORKSPACE_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
        status: { type: "string", description: "Optional workspace status filter." },
        limit: { type: "number", description: "Max results 1–100. Default 20." },
        offset: { type: "number", description: "Pagination offset. Default 0." },
      },
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_workspace: {
    description: `Read workspace metadata, kind, settings, and goal. REST: GET ${WORKSPACE_API_BASE}/{workspace_id}.`,
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string", description: "Workspace UUID." } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  create_workspace: {
    description:
      "Create a Learning or Verification workspace. Pass kind=learning|verification, optional title, settings, map blocks, or initial_prompt. REST: POST /api/v3/workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["learning", "verification", "standard", "knowledge_region"],
          description: "Workspace product. learning (standard) or verification (knowledge_region).",
        },
        product: { type: "string", description: "Alias for kind." },
        workspace_kind: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        workspace_goal: { type: "string" },
        initial_prompt: { type: "string" },
        learning_model_size: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
        is_public: { type: "boolean" },
        blocks: { type: "array", items: { type: "object" } },
        map: { type: "array", items: { type: "object" } },
        settings: { type: "object" },
      },
      additionalProperties: false,
    },
  },
  update_workspace: {
    description:
      "Edit workspace settings, contents, and map. REST: PATCH /api/v3/workspaces/{workspace_id}.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        workspace_goal: { type: "string" },
        learning_model_size: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
        is_public: { type: "boolean" },
        blocks: { type: "array", items: { type: "object" } },
        map: { type: "array", items: { type: "object" } },
        settings: { type: "object" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  list_blocks: {
    description: `List map blocks. REST: GET ${WORKSPACE_API_BASE}/{workspace_id}/blocks.`,
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_blocks: {
    description: `Replace the workspace map. REST: PATCH ${WORKSPACE_API_BASE}/{workspace_id}/blocks.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        blocks: { type: "array", items: { type: "object" } },
      },
      required: ["workspace_id", "blocks"],
      additionalProperties: false,
    },
  },
  get_workspace_settings: {
    description: `Read workspace settings. REST: GET ${WORKSPACE_API_BASE}/{workspace_id}/settings.`,
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_workspace_settings: {
    description: `Patch workspace settings. REST: PATCH ${WORKSPACE_API_BASE}/{workspace_id}/settings.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        workspace_goal: { type: "string" },
        learning_model_size: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
        is_public: { type: "boolean" },
        settings: { type: "object" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  get_account_settings: {
    description: `Read account settings for this key. REST: GET ${ACCOUNT_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {},
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_account_settings: {
    description: `Patch account settings. REST: PATCH ${ACCOUNT_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
        username: { type: "string" },
        display_name: { type: "string" },
      },
      additionalProperties: false,
    },
  },
  generate_integration_skill: {
    description:
      "Generate partner skill.md so ChatGPT, Claude, or another agent can authorize against Uncertain Systems and run workspace management plus headless flows. REST: POST .../integration-skill.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        integration_name: { type: "string" },
        base_url: { type: "string" },
        eval_definition: { type: "string" },
        prefetch_proof_of_work_spec: { type: "boolean" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  start_session: {
    description: `Start a headless Calibrate, Learn, Verify, or TAPBench session. Prepares the answers-model tree and starts the clock. REST: POST ${POW_API_BASE}/workspaces/{workspace_id}/sessions.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        block_id: { type: "string" },
        flow_kind: {
          type: "string",
          enum: [...FLOW_KIND_ENUM],
          description: "calibrate | learn | verify | tapbench (TAPBench is this same API).",
        },
        catalog_size: {
          type: "number",
          enum: [...CATALOG_SIZE_ENUM],
          description: "Action catalog 4, 8, or 16.",
        },
        duration_minutes: { type: "number", description: "Session length 1–120. Default 15." },
        chapter_title: { type: "string" },
        chapter_brief: { type: "string" },
      },
      required: ["workspace_id", "flow_kind"],
      additionalProperties: false,
    },
  },
  get_session: {
    description: `Read remaining time, inferred path, and answers model. REST: GET ${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        session_id: { type: "string" },
      },
      required: ["workspace_id", "session_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  upload_proof_of_work: {
    description: `Submit proof of work into a live headless session. The server infers the path on the prepared tree and rejects work after the clock expires. REST: POST ${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}/proof-of-work. ${powModelAgentSimulationContract()}`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        session_id: { type: "string" },
        events: {
          type: "array",
          items: { type: "object" },
          description: "Canvas / tool proof events (tool_action + metadata).",
        },
        type: {
          type: "string",
          enum: [...WORKSPACE_PROOF_OF_WORK_WIRE_TYPES],
        },
        mime_type: { type: "string" },
        data: { type: "string" },
        block_id: { type: "string" },
        file_name: { type: "string" },
        tool_name: { type: "string" },
        tool_action: { type: "string" },
        metadata: { type: "object" },
        timestamp_ms: { type: "number" },
        pow_model_version: POW_MODEL_VERSION_FIELD,
      },
      required: ["workspace_id", "session_id"],
      additionalProperties: false,
    },
  },
  end_session: {
    description: `End a headless session and persist the flow embedding (answers model + inferred path + proof). REST: POST ${POW_API_BASE}/workspaces/{workspace_id}/sessions/{session_id}/end.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        session_id: { type: "string" },
      },
      required: ["workspace_id", "session_id"],
      additionalProperties: false,
    },
  },
  list_flow_embeddings: {
    description:
      "List Calibrate, Learn, and Verify embeddings (flowcfg-v1-d96). REST: GET .../flow-embeddings.",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        flow_kind: {
          type: "string",
          enum: ["calibrate", "learn", "verify"],
        },
        flow_id: { type: "string" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  get_flow_embedding: {
    description:
      "Recover one flow embedding by id. REST: GET .../flow-embeddings?id=",
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        embedding_id: { type: "string" },
        id: { type: "string" },
      },
      required: ["workspace_id"],
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
