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