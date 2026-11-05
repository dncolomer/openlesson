import { afterEach, describe, expect, it, vi } from "vitest";
import type { Session } from "@/lib/domain/types";
import { persistIleSessionRow } from "@/lib/learn-session-persist";
import { resetIleSessionSaveQueueForTests } from "@/lib/learn-session-save-queue";
import { saveSolveLinkSession } from "@/lib/solve-session-storage";
import { buildIleSessionChatBody } from "@/lib/session-chat-client";

function solveSession(): Session {
  return {
    id: "sess-solve",
    problem: "Limits",
    startedAt: "2026-01-01T00:00:00.000Z",
    durationMs: 1200,
    status: "active",
    probes: [],
    objectives: ["epsilon"],
    hasAudio: false,
    metadata: {
      solve_flow_id: "sf1",
      identity: "ada",
      title: "Limits",
    } as Session["metadata"],
  };
}

describe("Solve guest session persist", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    resetIleSessionSaveQueueForTests();
  });

  it("saveSolveLinkSession posts the claimed session to the public Solve route", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: "sess-solve" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await saveSolveLinkSession("stok", solveSession());
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/solve/public/stok");
    expect(init.method).toBe("POST");
    const body = JSON.parse(String(init.body)) as {
      sessionId: string;
      session: { metadata?: { solve_flow_id?: string } };
    };
    expect(body.sessionId).toBe("sess-solve");
    expect(body.session.metadata?.solve_flow_id).toBe("sf1");
  });

  it("persistIleSessionRow uses solveToken instead of cookie saveSession", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ session: { id: "sess-solve" } }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await persistIleSessionRow(() => solveSession(), { solveToken: "stok" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/solve/public/stok");
    const body = JSON.parse(String(init.body)) as { sessionId: string };
    expect(body.sessionId).toBe("sess-solve");
  });

  it("buildIleSessionChatBody copies solveToken onto the session-chat POST", () => {
    const body = buildIleSessionChatBody({
      problem: "Limits",
      messages: [{ role: "user", content: "hi" }],
      sessionId: "sess-solve",
      solveToken: "stok",
    });
    expect(body.solveToken).toBe("stok");
    expect(body.sessionId).toBe("sess-solve");
  });
});
