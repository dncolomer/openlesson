import { afterEach, describe, expect, it, vi } from "vitest";
import { uploadTapWorkCanvasPow } from "@/lib/tap-work-canvas";
import { createAnonymousTapGuest } from "@/lib/pow-api/anonymous-tap-guest";
import {
  claimPublicIdentity,
  runVerificationCommand,
} from "@/lib/verification-flow-repository";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("public verification PoW session minting & error visibility", () => {
  it("mints sessionId and privateToken when claiming a public verification flow identity", async () => {
    const created = await runVerificationCommand({
      type: "create",
      workspaceId: "ws-public-pow-test",
      ownerUserId: "user-public-pow-test",
      topic: "Explain gradient descent",
    });
    expect(created.ok).toBe(true);
    if (!created.ok || !created.flow) return;

    const claimed = await claimPublicIdentity(
      created.flow.publicToken || "",
      "ada@example.com",
    );
    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.sessionId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
    expect(claimed.privateToken).toBeTruthy();
    expect((claimed.privateToken || "").length).toBeGreaterThanOrEqual(32);
  });

  it("surfaces uploadTapWorkCanvasPow HTTP errors via return value, warn log, and onError", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const onError = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ error: { message: "Session not found" } }), {
          status: 404,
          headers: { "Content-Type": "application/json" },
        }),
      ),
    );

    const res = await uploadTapWorkCanvasPow({
      tapSessionId: "00000000-0000-4000-8000-000000000001",
      privateToken: "tok-123",
      kind: "verify",
      item: {
        kind: "tool",
        toolName: "canvas",
        toolAction: "canvas_draw",
        fileName: "scene.json",
        mimeType: "application/json",
        payload: JSON.stringify({ elements: [] }),
        timestampMs: 123456,
      },
      onError,
    });

    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
    expect(res.error).toBe("Session not found");
    expect(onError).toHaveBeenCalledWith("Session not found");
    expect(warn).toHaveBeenCalled();
  });

  it("creates anonymous TAP guests without requiring a workspace_id column", async () => {
    let insertedRow: Record<string, unknown> | null = null;
    const supabase = {
      from: (table: string) => {
        expect(table).toBe("organization_guest_users");
        return {
          insert: (row: Record<string, unknown>) => {
            insertedRow = row;
            return {
              select: () => ({
                single: async () => ({
                  data: { id: "11111111-1111-4111-8111-111111111111" },
                  error: null,
                }),
              }),
            };
          },
        };
      },
    };

    const guest = await createAnonymousTapGuest(supabase as never, {
      workspaceId: "",
      organizationId: null,
      createdByUserId: "22222222-2222-4222-8222-222222222222",
    });

    expect(guest.id).toBe("11111111-1111-4111-8111-111111111111");
    expect(insertedRow).not.toBeNull();
    expect(insertedRow).not.toHaveProperty("workspace_id");
  });
});
