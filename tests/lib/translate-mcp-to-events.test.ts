import { describe, expect, it } from "vitest";
import {
  parseMcpToolResultPayload,
  translateMcpResultToEvents,
} from "@/lib/openlesson-demo/translate-mcp-to-events";

describe("translate-mcp-to-events", () => {
  it("parses MCP text tool content into JSON payloads", () => {
    const parsed = parseMcpToolResultPayload({
      content: [
        {
          type: "text",
          text: JSON.stringify({ workspaces: [{ id: "ws-1", title: "Trial workspace" }] }),
        },
      ],
    });

    expect(parsed).toEqual({
      workspaces: [{ id: "ws-1", title: "Trial workspace" }],
    });
  });

  it("translates array records into pending simulation events", () => {
    const events = translateMcpResultToEvents(
      "list_blocks",
      "List workspace blocks",
      {
        content: [
          {
            type: "text",
            text: JSON.stringify({
              blocks: [
                { id: "b1", title: "Connect email", status: "completed" },
                { id: "b2", title: "Import contacts", status: "pending" },
              ],
            }),
          },
        ],
      }
    );

    expect(events).toHaveLength(2);
    expect(events[0].label).toBe("Connect email");
    expect(events[0].verb).toBe("list_blocks_1");
    expect(events[0].status).toBe("pending");
    expect(events[0].mcpTool).toBe("list_blocks");
    expect(events[1].outcome).toBe("partial");
  });

  it("creates a single event when no record array is found", () => {
    const events = translateMcpResultToEvents("ping", "Health check", { ok: true });
    expect(events).toHaveLength(1);
    expect(events[0].verb).toBe("ping");
    expect(events[0].sourceData).toEqual({ ok: true, mcp_import: true });
  });
});