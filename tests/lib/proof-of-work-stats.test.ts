import { describe, expect, it } from "vitest";
import {
  aggregateProofOfWorkStats,
  formatProofOfWorkBytes,
  type ProofOfWorkStatsRow,
} from "@/lib/agent-v2/proof-of-work-stats";

function row(partial: Partial<ProofOfWorkStatsRow> & { created_at: string }): ProofOfWorkStatsRow {
  return {
    proof_of_work_type: "tool",
    tool_name: null,
    tool_action: null,
    block_id: null,
    session_id: null,
    file_size: null,
    mime_type: "application/json",
    device_name: null,
    timestamp_ms: Date.parse(partial.created_at),
    ...partial,
  };
}

describe("aggregateProofOfWorkStats", () => {
  it("returns zeros for empty input", () => {
    const stats = aggregateProofOfWorkStats("ws-1", 0, []);
    expect(stats.total_artifacts).toBe(0);
    expect(stats.sampled_artifacts).toBe(0);
    expect(stats.unique_sessions).toBe(0);
    expect(stats.by_type.every((entry) => entry.count === 0)).toBe(true);
    expect(stats.top_tools).toEqual([]);
    expect(stats.recent).toEqual([]);
  });

  it("aggregates type, tools, sessions, and block coverage", () => {
    const now = Date.now();
    const rows: ProofOfWorkStatsRow[] = [
      row({
        created_at: new Date(now - 1000).toISOString(),
        timestamp_ms: now - 1000,
        proof_of_work_type: "tool",
        tool_name: "canvas",
        tool_action: "draw",
        block_id: "b1",
        session_id: "s1",
        file_size: 100,
      }),
      row({
        created_at: new Date(now - 2000).toISOString(),
        timestamp_ms: now - 2000,
        proof_of_work_type: "tool",
        tool_name: "canvas",
        block_id: "b1",
        session_id: "s1",
        file_size: 200,
      }),
      row({
        created_at: new Date(now - 3000).toISOString(),
        timestamp_ms: now - 3000,
        proof_of_work_type: "screen",
        session_id: "s2",
        file_size: 300,
      }),
      row({
        created_at: new Date(now - 4000).toISOString(),
        timestamp_ms: now - 4000,
        proof_of_work_type: "eeg",
        tool_name: "muse",
        block_id: "b2",
        file_size: 400,
      }),
    ];

    const stats = aggregateProofOfWorkStats("ws-1", 4, rows);
    expect(stats.total_artifacts).toBe(4);
    expect(stats.unique_sessions).toBe(2);
    expect(stats.unique_blocks).toBe(2);
    expect(stats.unique_tools).toBe(2);
    expect(stats.with_block).toBe(3);
    expect(stats.without_block).toBe(1);
    expect(stats.total_bytes).toBe(1000);
    expect(stats.avg_bytes).toBe(250);
    expect(stats.by_type.find((e) => e.type === "tool")?.count).toBe(2);
    expect(stats.by_type.find((e) => e.type === "screen")?.count).toBe(1);
    expect(stats.by_type.find((e) => e.type === "eeg")?.count).toBe(1);
    expect(stats.top_tools[0]).toEqual({ tool_name: "canvas", count: 2 });
    expect(stats.recent[0].tool_name).toBe("canvas");
    expect(stats.sample_capped).toBe(false);
  });

  it("flags sample cap when total exceeds sampled rows", () => {
    const stats = aggregateProofOfWorkStats("ws-1", 50, [
      row({ created_at: new Date().toISOString(), proof_of_work_type: "video" }),
    ]);
    expect(stats.sample_capped).toBe(true);
    expect(stats.sampled_artifacts).toBe(1);
    expect(stats.total_artifacts).toBe(50);
  });
});

describe("formatProofOfWorkBytes", () => {
  it("formats common sizes", () => {
    expect(formatProofOfWorkBytes(null)).toBe("—");
    expect(formatProofOfWorkBytes(512)).toBe("512 B");
    expect(formatProofOfWorkBytes(2048)).toBe("2.0 KB");
    expect(formatProofOfWorkBytes(2 * 1024 * 1024)).toBe("2.0 MB");
  });
});
