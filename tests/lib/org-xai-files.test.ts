/**
 * All live xAI Files writes go through the org-scoped helper (org key + collection).
 * Mocks uploadFileToXAI / ensureOrgXaiApiKey — not the helper under test.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn(() => ({ from: vi.fn() })),
}));

vi.mock("@/lib/organization/ensure-xai-resources", () => ({
  ensureOrgXaiApiKey: vi.fn(async () => ({ apiKey: "org-key-1", apiKeyId: "kid", fromOrg: true })),
  attachFileToOrgCollection: vi.fn(async () => "col-1"),
}));

vi.mock("@/lib/xai-files", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/xai-files")>();
  return {
    ...actual,
    uploadFileToXAI: vi.fn(async (name: string) => ({
      file_id: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
      name,
      size_bytes: 12,
      content_type: "application/json",
    })),
    getFileContentResponse: vi.fn(async () => new Response("ok")),
    deleteFileFromXAI: vi.fn(async () => true),
  };
});

import { uploadFileToXAI } from "@/lib/xai-files";
import {
  attachFileToOrgCollection,
  ensureOrgXaiApiKey,
} from "@/lib/organization/ensure-xai-resources";
import { uploadOrgScopedXaiFile } from "@/lib/organization/org-xai-files";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("uploadOrgScopedXaiFile", () => {
  beforeEach(() => {
    vi.mocked(uploadFileToXAI).mockClear();
    vi.mocked(ensureOrgXaiApiKey).mockClear();
    vi.mocked(attachFileToOrgCollection).mockClear();
  });

  it("uploads with the org key and attaches the collection", async () => {
    const result = await uploadOrgScopedXaiFile("trace.json", "application/json", "e30=", {
      organizationId: "org-1",
      collectionFields: { workspace_id: "ws-1" },
    });
    expect(result.file_id).toBe("file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee");
    expect(result.collectionId).toBe("col-1");
    expect(result.apiKey).toBe("org-key-1");
    expect(vi.mocked(ensureOrgXaiApiKey)).toHaveBeenCalled();
    expect(vi.mocked(uploadFileToXAI)).toHaveBeenCalledWith(
      "trace.json",
      "application/json",
      "e30=",
      { apiKey: "org-key-1" },
    );
    expect(vi.mocked(attachFileToOrgCollection)).toHaveBeenCalled();
  });
});

describe("live surfaces use the org-scoped Files path", () => {
  it("workspace files, session files, and seed uploads call the helper", () => {
    const files = [
      "app/api/workspace/files/route.ts",
      "app/api/session-files/upload/route.ts",
      "app/api/session-files/download/route.ts",
      "app/api/session-files/cleanup/route.ts",
      "app/api/session-transcripts/upload/route.ts",
      "app/api/session/performance-chat/route.ts",
      "app/api/workspace/generate/route.ts",
      "lib/pow-api/create-agent-workspace.ts",
      "lib/pow-api/create-verification-workspace.ts",
      "lib/pow-api/upload-workspace-proof-of-work.ts",
      "lib/pow-api/performance-context.ts",
    ];
    for (const rel of files) {
      const src = read(rel);
      expect(src, rel).toMatch(
        /uploadOrgScopedXaiFile|getOrgScopedFileContentResponse|deleteOrgScopedXaiFile/,
      );
      expect(src, rel).not.toMatch(/uploadFileToXAI\(/);
    }
  });

  it("thought-trace and headless ingest still go through the shared PoW uploader", () => {
    expect(read("app/api/workspace-tap-score/trace/route.ts")).toContain(
      "uploadWorkspaceProofOfWork",
    );
    expect(read("lib/pow-api/headless-session.ts")).toContain("uploadWorkspaceProofOfWork");
    expect(read("lib/pow-api/mcp-tools/dispatch.ts")).toContain(
      "ingestHeadlessProofForWorkspace",
    );
  });
});
