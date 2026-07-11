export type McpToolDescriptor = {
  name: string;
  description?: string;
  inputSchema?: Record<string, unknown>;
};

export type McpImportLogEntry = {
  id: string;
  timestamp: string;
  level: "info" | "success" | "error";
  message: string;
  detail?: string;
};

export type McpSimulationEventStatus = "pending" | "simulated" | "failed";

export type McpSimulationEvent = {
  id: string;
  verb: string;
  label: string;
  description: string;
  timestamp: string;
  mcpTool: string;
  outcome?: "success" | "partial" | "struggle" | "failure";
  sourceData: Record<string, unknown>;
  status: McpSimulationEventStatus;
  evidenceId?: string;
};

export type McpConnectResult = {
  server_info?: { name?: string; version?: string };
  tools: McpToolDescriptor[];
  import_log: McpImportLogEntry[];
};

export type McpPullResult = {
  tool_name: string;
  raw_result: unknown;
  events: McpSimulationEvent[];
  import_log: McpImportLogEntry[];
};