import { describe, expect, it } from "vitest";
import {
  isAllowedEvidenceMime,
  normalizeEvidenceType,
  defaultEvidenceFileName,
} from "@/lib/agent-v2/workspace-evidence";

describe("workspace evidence helpers", () => {
  it("normalizes evidence type aliases", () => {
    expect(normalizeEvidenceType("screenshot")).toBe("screen");
    expect(normalizeEvidenceType("TOOL")).toBe("tool");
    expect(normalizeEvidenceType("eeg")).toBe("eeg");
    expect(normalizeEvidenceType("unknown")).toBeNull();
  });

  it("validates mime types per evidence type", () => {
    expect(isAllowedEvidenceMime("tool", "application/json")).toBe(true);
    expect(isAllowedEvidenceMime("screen", "image/png")).toBe(true);
    expect(isAllowedEvidenceMime("video", "video/mp4")).toBe(true);
    expect(isAllowedEvidenceMime("eeg", "application/json")).toBe(true);
    expect(isAllowedEvidenceMime("screen", "application/json")).toBe(false);
  });

  it("provides default file names", () => {
    expect(defaultEvidenceFileName("tool")).toBe("tool-usage.json");
    expect(defaultEvidenceFileName("screen", "capture-1.png")).toBe("capture-1.png");
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