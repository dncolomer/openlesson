/**
 * Thought traces persist through uploadWorkspaceProofOfWork (org key + collection).
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { createMemoryAgentSupabase } from "@/tests/helpers/memory-agent-supabase";

vi.mock("@/lib/tap-score-session-auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/tap-score-session-auth")>();
  return {
    ...actual,
    resolveTapSessionAccess: vi.fn(),
  };
});

vi.mock("@/lib/usage-enforcement", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/usage-enforcement")>();
  return {
    ...actual,
    assertCanSubmitProofOfWork: vi.fn(async () => undefined),
  };
});

vi.mock("@/lib/xai-files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/xai-files")>();
  return {
    ...actual,
    uploadFileToXAI: vi.fn(async (name: string) => ({
      file_id: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      name,
      size_bytes: 24,
      content_type: "application/json",
    })),
  };
});

import { resolveTapSessionAccess } from "@/lib/tap-score-session-auth";
import { uploadFileToXAI } from "@/lib/xai-files";
import { POST } from "@/app/api/workspace-tap-score/trace/route";
import { TAP_TRACE_TOOL_NAME } from "@/lib/tap-score-traces";

const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-ab7c040d7287/implementer";

describe("TAP thought traces use the shared Files uploader", () => {
  beforeEach(() => {
    vi.mocked(uploadFileToXAI).mockClear();
  });

  it("POSTs a system2 send through uploadWorkspaceProofOfWork and stores an xAI file id", async () => {
    const supabase = createMemoryAgentSupabase({
      workspaces: [{ id: "ws-1", user_id: "user-1", organization_id: null, title: "Field" }],
    });
    vi.mocked(resolveTapSessionAccess).mockResolvedValue({
      supabase: supabase as never,
      workspaceId: "ws-1",
      userId: "user-1",
      guestUserId: null,
      assignedUserId: null,
      workspaceOwnerUserId: "user-1",
      organizationId: null,
      blockId: null,
      focusSessionId: null,
      tapSessionId: "tap-1",
      sessionTable: "workspace_verify_sessions",
      postSession: "redirect_workspace",
      redirectUrl: null,
      completionWebhookUrl: null,
      existingSession: { id: "tap-1" },
    });

    const res = await POST(
      new NextRequest("http://localhost/api/workspace-tap-score/trace", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          privateToken: "tok",
          workspaceId: "ws-1",
          tapSessionId: "tap-1",
          traceType: "system2",
          action: "send",
          thoughtId: "th-1",
          text: "I close this observation.",
          timestampMs: 1_700_000_000_000,
        }),
      }),
    );
    expect(res.status).toBe(201);
    const json = (await res.json()) as { trace: { xai_file_id?: string; tool_name?: string } };
    expect(json.trace.tool_name).toBe(TAP_TRACE_TOOL_NAME);
    expect(json.trace.xai_file_id).toBe("file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(vi.mocked(uploadFileToXAI)).toHaveBeenCalled();

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, "tap-trace-xai.log"), JSON.stringify(json, null, 2));
  });
});
