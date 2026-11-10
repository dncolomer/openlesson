/**
 * MCP tools/list catalog — 1:1 with AGENT_TOOL_SURFACE (flow management).
 */

import { AGENT_TOOL_SURFACE } from "../agent-tool-surface";
import { FLOW_API_BASE } from "@/lib/api/agent-api-paths";

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
    description: `Create a Solve, Calibration, or Verification flow. REST: POST ${FLOW_API_BASE}.`,
    inputSchema: {
      type: "object",
      properties: {
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
