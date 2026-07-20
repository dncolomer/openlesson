import { describe, expect, it } from "vitest";
import { extractInsightThoughtsFromPowRows } from "@/lib/insights-traces";

describe("extractInsightThoughtsFromPowRows", () => {
  it("keeps latest non-empty text per thought_id", () => {
    const thoughts = extractInsightThoughtsFromPowRows([
      {
        id: "pow-1",
        session_id: "s1",
        block_id: "b1",
        timestamp_ms: 1000,
        created_at: "2026-01-01T00:00:01Z",
        metadata: { thought_id: "t1", text: "first draft" },
        tool_action: "system2:send",
      },
      {
        id: "pow-2",
        session_id: "s1",
        block_id: "b1",
        timestamp_ms: 2000,
        created_at: "2026-01-01T00:00:02Z",
        metadata: { thought_id: "t1", text: "edited takeaway" },
        tool_action: "system2:edit",
      },
      {
        id: "pow-3",
        session_id: "s1",
        block_id: null,
        timestamp_ms: 1500,
        created_at: "2026-01-01T00:00:01.500Z",
        metadata: { thought_id: "t2", text: "second idea" },
        tool_action: "system1:crystallize",
      },
      {
        id: "pow-4",
        session_id: "s1",
        block_id: null,
        timestamp_ms: 3000,
        created_at: "2026-01-01T00:00:03Z",
        metadata: { thought_id: "t3", text: "   " },
        tool_action: "system2:send",
      },
    ]);

    expect(thoughts).toEqual([
      {
        id: "t2",
        text: "second idea",
        timestamp: 1500,
        sessionId: "s1",
        blockId: null,
      },
      {
        id: "t1",
        text: "edited takeaway",
        timestamp: 2000,
        sessionId: "s1",
        blockId: "b1",
      },
    ]);
  });

  it("falls back to pow row id when thought_id is missing", () => {
    const thoughts = extractInsightThoughtsFromPowRows([
      {
        id: "pow-orphan",
        session_id: null,
        block_id: null,
        timestamp_ms: 50,
        created_at: "2026-01-01T00:00:00.050Z",
        metadata: { text: "orphan trace" },
        tool_action: null,
      },
    ]);
    expect(thoughts).toHaveLength(1);
    expect(thoughts[0]).toMatchObject({
      id: "pow-orphan",
      text: "orphan trace",
      timestamp: 50,
    });
  });

  it("skips rows without text", () => {
    expect(
      extractInsightThoughtsFromPowRows([
        {
          id: "pow-empty",
          session_id: null,
          block_id: null,
          timestamp_ms: 1,
          created_at: "2026-01-01T00:00:00Z",
          metadata: { thought_id: "t1" },
          tool_action: null,
        },
      ]),
    ).toEqual([]);
  });
});
