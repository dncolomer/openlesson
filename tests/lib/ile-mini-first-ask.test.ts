/**
 * Leave-tab no longer opens a first-ask picture-in-picture window.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("TAP Learning mini first-ask is gone", () => {
  it("does not open a floating window on leave, blur, or an external tool", () => {
    expect(existsSync(join(ROOT, "lib/ile-blur-screenshare.ts"))).toBe(false);
    const tools = read("components/ToolsPanel.tsx");
    expect(existsSync(join(ROOT, "lib/useIleBlurScreenshare.tsx"))).toBe(false);

    const view = read("components/SessionView.tsx");
    expect(tools).not.toContain("data-ile-open-pic-in-pic");
    expect(tools).not.toContain("ILE_OPEN_PIC_IN_PIC_LABEL");
    expect(view).not.toContain("onOpenPicInPic");
  });
});
