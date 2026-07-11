import { describe, expect, it } from "vitest";
import {
  isAllowedProofOfWorkMime,
  normalizeProofOfWorkType,
  defaultProofOfWorkFileName,
} from "@/lib/agent-v2/workspace-proof-of-work";

describe("workspace proof of work helpers", () => {
  it("normalizes proof-of-work type aliases", () => {
    expect(normalizeProofOfWorkType("screenshot")).toBe("screen");
    expect(normalizeProofOfWorkType("TOOL")).toBe("tool");
    expect(normalizeProofOfWorkType("eeg")).toBe("eeg");
    expect(normalizeProofOfWorkType("unknown")).toBeNull();
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