import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  checkProofOfWorkSchema,
  isAllowedProofOfWorkMime,
  normalizeProofOfWorkType,
  defaultProofOfWorkFileName,
  insertWorkspaceProofOfWorkRow,
  queryWorkspaceProofOfWorkRows,
  countWorkspaceProofOfWorkForPlan,
  POW_MODEL_VERSION,
  WORKSPACE_PROOF_OF_WORK_TYPES,
  WORKSPACE_PROOF_OF_WORK_WIRE_TYPES,
} from "@/lib/pow-api/workspace-proof-of-work";
import { uploadWorkspaceProofOfWork } from "@/lib/pow-api/upload-workspace-proof-of-work";
import { parseStashIngestInput } from "@/lib/pow-api/stash-api";
import { MCP_EVIDENCE_TOOLS } from "@/lib/pow-api/mcp-tools/helpers";
import type { IleProofOfWorkCaptureType } from "@/lib/ile-proof-of-work-client";

describe("workspace proof of work helpers", () => {
  it("normalizes proof-of-work type aliases", () => {
    expect(normalizeProofOfWorkType("screenshot")).toBe("screen");
    expect(normalizeProofOfWorkType("screenshots")).toBe("screen");
    expect(normalizeProofOfWorkType("TOOL")).toBe("tool");
    expect(normalizeProofOfWorkType("eeg")).toBe("eeg");
    expect(normalizeProofOfWorkType("unknown")).toBeNull();
    expect(normalizeProofOfWorkType("speech")).toBeNull();
  });

  it("validates mime types per proof-of-work type", () => {
    expect(isAllowedProofOfWorkMime("tool", "application/json")).toBe(true);
    expect(isAllowedProofOfWorkMime("screen", "image/png")).toBe(true);
    expect(isAllowedProofOfWorkMime("video", "video/mp4")).toBe(true);
    expect(isAllowedProofOfWorkMime("eeg", "application/json")).toBe(true);
    expect(isAllowedProofOfWorkMime("screen", "application/json")).toBe(false);
  });

  it("provides default file names", () => {
    expect(defaultProofOfWorkFileName("tool")).toBe("tool-usage.json");
    expect(defaultProofOfWorkFileName("screen", "capture-1.png")).toBe("capture-1.png");
  });
});

const jsonData = Buffer.from(JSON.stringify({ event: "ok" })).toString("base64");
const pngData = Buffer.from([0x89, 0x50, 0x4e, 0x47]).toString("base64");

describe("checkProofOfWorkSchema — sole write-time gate", () => {
  it("accepts stored types and screenshot aliases, stamps pow-model-v1", () => {
    const tool = checkProofOfWorkSchema({
      type: "tool",
      mime_type: "application/json",
      data: jsonData,
    });
    expect(tool.ok).toBe(true);
    if (tool.ok) {
      expect(tool.type).toBe("tool");
      expect(tool.pow_model_version).toBe(POW_MODEL_VERSION);
      expect(tool.pow_model_version).toBe("pow-model-v1");
    }

    const shot = checkProofOfWorkSchema({
      type: "screenshot",
      mime_type: "image/png",
      data: pngData,
    });
    expect(shot.ok).toBe(true);
    if (shot.ok) expect(shot.type).toBe("screen");
  });

  it("rejects speech, unknown types, disallowed MIME, and unknown versions", () => {
    const speech = checkProofOfWorkSchema({
      type: "speech",
      mime_type: "application/json",
      data: jsonData,
    });
    expect(speech.ok).toBe(false);
    if (!speech.ok) expect(speech.code).toBe("unknown_type");

    const unknown = checkProofOfWorkSchema({
      type: "audio",
      mime_type: "application/json",
      data: jsonData,
    });
    expect(unknown.ok).toBe(false);

    const mime = checkProofOfWorkSchema({
      type: "screen",
      mime_type: "application/json",
      data: jsonData,
    });
    expect(mime.ok).toBe(false);
    if (!mime.ok) expect(mime.code).toBe("mime_not_allowed");

    const version = checkProofOfWorkSchema({
      type: "tool",
      mime_type: "application/json",
      data: jsonData,
      pow_model_version: "pow-model-v2",
    });
    expect(version.ok).toBe(false);
    if (!version.ok) expect(version.code).toBe("unknown_model_version");
  });
});

describe("uploadWorkspaceProofOfWork uses the shared schema", () => {
  const workspace = { id: "ws-1", user_id: "user-1", organization_id: null };
  const auth = {
    user_id: "user-1",
    guest_user_id: null,
    organization_id: null,
    is_org_admin: false,
    key_id: "key-1",
    scopes: ["workspaces:write" as const],
  };

  it("rejects speech before persist", async () => {
    await expect(
      uploadWorkspaceProofOfWork({} as never, auth, workspace, {
        workspaceId: "ws-1",
        type: "speech",
        mime_type: "application/json",
        data: jsonData,
      }),
    ).rejects.toThrow(/type must be one of/);
  });

  it("rejects unknown pow_model_version before persist", async () => {
    await expect(
      uploadWorkspaceProofOfWork({} as never, auth, workspace, {
        workspaceId: "ws-1",
        type: "tool",
        mime_type: "application/json",
        data: jsonData,
        pow_model_version: "pow-model-v9",
      }),
    ).rejects.toThrow(/pow_model_version must be pow-model-v1/);
  });
});

describe("stash ingest uses the shared schema", () => {
  it("rejects speech and accepts screenshot", () => {
    expect(
      parseStashIngestInput({
        type: "speech",
        mime_type: "application/json",
        data: jsonData,
      }).ok,
    ).toBe(false);

    const screen = parseStashIngestInput({
      type: "screenshot",
      mime_type: "image/png",
      data: pngData,
    });
    expect(screen.ok).toBe(true);
    if (screen.ok) {
      expect(screen.unit.type).toBe("screen");
      expect(screen.unit.pow_model_version).toBe("pow-model-v1");
    }
  });
});

describe("surfaces share the exported type list", () => {
  const ROOT = join(__dirname, "../..");

  it("MCP upload enum is WORKSPACE_PROOF_OF_WORK_WIRE_TYPES", () => {
    const upload = MCP_EVIDENCE_TOOLS.find((t) => t.name === "upload_proof_of_work");
    const typeSchema = upload?.inputSchema?.properties?.type;
    expect(typeSchema && "enum" in typeSchema ? typeSchema.enum : undefined).toEqual([
      ...WORKSPACE_PROOF_OF_WORK_WIRE_TYPES,
    ]);
    expect(typeSchema && "enum" in typeSchema ? typeSchema.enum : []).not.toContain("speech");
  });

  it("ILE capture types are a subset of stored types", () => {
    const ile: IleProofOfWorkCaptureType[] = ["tool", "screen", "eeg"];
    for (const t of ile) {
      expect(WORKSPACE_PROOF_OF_WORK_TYPES).toContain(t);
    }
    expect(ile).not.toContain("video");
  });

  it("TAP product insert goes through checkProofOfWorkSchema", () => {
    const src = readFileSync(join(ROOT, "app/api/workspace-tap-score/trace/route.ts"), "utf8");
    expect(src).toContain("checkProofOfWorkSchema");
    expect(src).toContain("insertWorkspaceProofOfWorkRow");
    expect(src).toContain("pow_model_version");
  });
});

describe("demo evidence constraints", () => {
  const uuidRe =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

  it("treats ui-session as a non-uuid api key id", () => {
    expect(uuidRe.test("ui-session")).toBe(false);
  });

  it("accepts real api key uuids", () => {
    expect(uuidRe.test("a1b2c3d4-5678-41a2-b3c4-1234567890ab")).toBe(true);
  });
});

describe("modern-only proof-of-work storage path", () => {
  it("inserts only into workspace_proof_of_work (no legacy table fallback)", async () => {
    const calls: string[] = [];
    const inserted: Record<string, unknown>[] = [];
    const supabase = {
      from(table: string) {
        calls.push(table);
        return {
          insert(payload: Record<string, unknown>) {
            inserted.push(payload);
            return this;
          },
          select() {
            return this;
          },
          single: async () => ({
            data: {
              id: "pow-1",
              workspace_id: "ws-1",
              block_id: null,
              session_id: null,
              proof_of_work_type: "tool",
              pow_model_version: "pow-model-v1",
              file_name: "t.json",
              mime_type: "application/json",
              file_size: 1,
              xai_file_id: "file_814439bd-4894-4e11-852d-314e9f777a7f",
              timestamp_ms: Date.now(),
              chunk_index: 0,
              metadata: {},
              tool_name: "demo",
              tool_action: "act",
              device_name: null,
              sample_count: null,
              created_at: new Date().toISOString(),
            },
            error: null,
          }),
        };
      },
    };

    const { row, error } = await insertWorkspaceProofOfWorkRow(supabase as never, {
      workspace_id: "ws-1",
      proof_of_work_type: "tool",
    });
    expect(error).toBeNull();
    expect(row?.proof_of_work_type).toBe("tool");
    expect(row?.pow_model_version).toBe("pow-model-v1");
    expect(inserted[0]?.pow_model_version).toBe("pow-model-v1");
    expect(calls).toEqual(["workspace_proof_of_work"]);
    expect(calls).not.toContain("workspace_evidence");
  });

  it("rejects insert payloads that claim an unknown pow_model_version", async () => {
    const { row, error } = await insertWorkspaceProofOfWorkRow({} as never, {
      workspace_id: "ws-1",
      proof_of_work_type: "tool",
      pow_model_version: "pow-model-v2",
    });
    expect(row).toBeNull();
    expect(error?.message).toMatch(/pow_model_version must be pow-model-v1/);
  });

  it("queries without dual-table fallback signature", async () => {
    const { data, error } = await queryWorkspaceProofOfWorkRows(
      Promise.resolve({ data: [{ id: "1" }], error: null }),
    );
    expect(error).toBeNull();
    expect(data).toEqual([{ id: "1" }]);
  });

  it("counts only workspace_proof_of_work", async () => {
    const calls: string[] = [];
    const supabase = {
      from(table: string) {
        calls.push(table);
        return {
          select() {
            return this;
          },
          eq() {
            return Promise.resolve({ count: 3, error: null });
          },
        };
      },
    };
    const count = await countWorkspaceProofOfWorkForPlan(supabase as never, "ws-1");
    expect(count).toBe(3);
    expect(calls).toEqual(["workspace_proof_of_work"]);
  });
});

describe("xAI file id format", () => {
  const xaiFileIdRe =
    /^file_[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  it("rejects test placeholder file ids", () => {
    expect(xaiFileIdRe.test("file-test-456")).toBe(false);
    expect(xaiFileIdRe.test("file-demo-test-001")).toBe(false);
  });

  it("accepts real xAI file ids", () => {
    expect(xaiFileIdRe.test("file_814439bd-4894-4e11-852d-314e9f777a7f")).toBe(true);
  });
});