import { beforeEach, describe, expect, it, vi } from "vitest";

const eq = vi.fn();
const update = vi.fn(() => ({ eq }));
const from = vi.fn(() => ({ update }));

vi.mock("@/lib/supabase/client", () => ({
  createClient: vi.fn(() => ({ from })),
}));

import { saveSession } from "@/lib/storage/sessions";
import type { Session } from "@/lib/domain/types";

function sampleSession(overrides: Partial<Session> = {}): Session {
  return {
    id: "sess-1",
    problem: "test problem",
    status: "active",
    durationMs: 1000,
    startedAt: new Date().toISOString(),
    probes: [],
    objectives: [],
    hasAudio: false,
    metadata: {},
    ...overrides,
  };
}

describe("saveSession", () => {
  beforeEach(() => {
    from.mockClear();
    update.mockClear();
    eq.mockReset();
  });

  it("throws when supabase returns an error", async () => {
    eq.mockResolvedValue({ error: { message: "db write failed" } });
    await expect(saveSession(sampleSession())).rejects.toThrow("db write failed");
    expect(from).toHaveBeenCalledWith("sessions");
  });

  it("resolves when update succeeds", async () => {
    eq.mockResolvedValue({ error: null });
    await expect(saveSession(sampleSession())).resolves.toBeUndefined();
  });
});
