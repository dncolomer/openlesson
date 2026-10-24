/**
 * SessionView must not remount the unused think-aloud transcript hook
 * or keep an unread autoAdvanceRef.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

describe("SessionView dead wiring is gone", () => {
  it("does not call useThinkAloudTranscript or keep autoAdvanceRef", () => {
    const view = read("components/SessionView.tsx");
    expect(view).not.toContain("useThinkAloudTranscript");
    expect(view).not.toContain("autoAdvanceRef");
    expect(view).not.toContain("consumeSpeechTranscriptEntriesRef");
    expect(view).not.toContain("requeueSpeechTranscriptEntriesRef");
    expect(view).toContain("autoAdvance");
  });
});
