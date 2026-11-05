/**
 * MCP tools/list catalog — 1:1 with AGENT_TOOL_SURFACE (Learning Map + flow management).
 */

import { AGENT_TOOL_SURFACE } from "../agent-tool-surface";
import { WORKSPACE_API_BASE, FLOW_API_BASE } from "@/lib/api/agent-api-paths";
import { HELIOS_MAP_TOOL_IDS } from "@/lib/workspace-helios-tools";

const CATALOG_SIZE_ENUM = [4, 8, 16] as const;
const PRODUCT_FLOW_KIND_ENUM = ["solve", "calibration", "verification"] as const;

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
    description: `List Learning workspaces. REST: GET ${WORKSPACE_API_BASE}.`,
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
    description: `Read Learning Map metadata, kind, and settings. REST: GET ${WORKSPACE_API_BASE}/{workspace_id}.`,
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
      "Create a Learning Map only (kind=learning|standard). Solve, Calibration, and Verification use create_flow. Optional title, settings, map blocks, or initial_prompt. REST: POST /api/v3/workspaces.",
    inputSchema: {
      type: "object",
      properties: {
        kind: {
          type: "string",
          enum: ["learning", "standard"],
          description: "Learning only. verification, calibration, and knowledge_region are refused.",
        },
        product: {
          type: "string",
          enum: ["learning", "standard"],
          description: "Alias for kind.",
        },
        workspace_kind: {
          type: "string",
          enum: ["learning", "standard"],
        },
        title: { type: "string" },
        description: { type: "string" },
        notes: { type: "string" },
        initial_prompt: { type: "string" },
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
  list_map_tools: {
    description: `List Helios Learning Map builder tools and the current map snapshot (blocks, unusable ground, notes, drawing layers). Learning workspaces only. REST: GET ${WORKSPACE_API_BASE}/{workspace_id}/map-tools.`,
    inputSchema: {
      type: "object",
      properties: { workspace_id: { type: "string" } },
      required: ["workspace_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  apply_map_tool: {
    description: `Apply one Helios map tool or a batch (tool_calls) atomically — same catalog as in-app Helios (add_block, generate_shape, split/clone/expand/combine/bridge/cluster, mark_unusable, generative effects, apply_dag, edit/delete, overlay notes and drawing layers). Learning workspaces only. REST: POST ${WORKSPACE_API_BASE}/{workspace_id}/map-tools.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        tool: { type: "string", enum: [...HELIOS_MAP_TOOL_IDS] },
        name: { type: "string", enum: [...HELIOS_MAP_TOOL_IDS] },
        id: { type: "string", description: "Alias for tool id." },
        arguments: { type: "object" },
        args: { type: "object" },
        payload: { type: "object" },
        tool_calls: { type: "array", items: { type: "object" } },
        toolCalls: { type: "array", items: { type: "object" } },
        calls: { type: "array", items: { type: "object" } },
      },
      required: ["workspace_id"],
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
        is_public: { type: "boolean" },
        settings: { type: "object" },
      },
      required: ["workspace_id"],
      additionalProperties: false,
    },
  },
  list_flows: {
    description: `List Solve, Calibration, and Verification flows owned by this key. Optional workspace_id filters to one Learning Map. REST: GET ${FLOW_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
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
    description: `Create a Solve, Calibration, or Verification flow. Independent unless workspace_id is set. REST: POST ${FLOW_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        kind: {
          type: "string",
          enum: [...PRODUCT_FLOW_KIND_ENUM],
          description: "solve | calibration | verification",
        },
        name: { type: "string" },
        topic: { type: "string" },
        goal: { type: "string" },
        questions: { type: "array", items: { type: "string" } },
        duration_minutes: { type: "number" },
        action_catalog: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
      },
      required: ["kind"],
      additionalProperties: false,
    },
  },
  get_flow: {
    description: `Read one flow. REST: GET ${FLOW_API_BASE}/{flow_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        flow_id: { type: "string" },
        workspace_id: { type: "string" },
      },
      required: ["flow_id"],
      additionalProperties: false,
    },
    annotations: { readOnlyHint: true },
  },
  update_flow: {
    description: `Update a Solve, Calibration, or Verification flow. REST: PATCH ${FLOW_API_BASE}/{flow_id}.`,
    inputSchema: {
      type: "object",
      properties: {
        flow_id: { type: "string" },
        workspace_id: { type: "string" },
        name: { type: "string" },
        topic: { type: "string" },
        goal: { type: "string" },
        questions: { type: "array", items: { type: "string" } },
        duration_minutes: { type: "number" },
        action_catalog: { type: "number", enum: [...CATALOG_SIZE_ENUM] },
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
  link_flow: {
    description: `Place a flow on a Learning Map tile. REST: POST ${FLOW_API_BASE}/{flow_id}/link.`,
    inputSchema: {
      type: "object",
      properties: {
        workspace_id: { type: "string" },
        flow_id: { type: "string" },
        block_id: { type: "string" },
      },
      required: ["workspace_id", "flow_id", "block_id"],
      additionalProperties: false,
    },
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
