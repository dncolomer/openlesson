/**
 * The detached compact stash window is gone. The main canvas helpers remain.
 */
import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("ILE compact stash window is removed", () => {
  it("does not paint a second document, and the main canvas still binds surface events", () => {
    expect(existsSync(join(ROOT, "components/IleCompactStashWindow.tsx"))).toBe(false);
    expect(existsSync(join(ROOT, "lib/ile-compact-chrome.ts"))).toBe(false);
    const view = read("components/SessionView.tsx");
    const canvas = read("components/ExcalidrawCanvas.tsx");
    const helpers = read("lib/ile-compact-window.ts");
    expect(view).not.toContain('peerId="pip"');
    expect(view).not.toContain("data-ile-compact-chapter-workspace");
    expect(canvas).toContain("bindIleSurfaceEditorEvents");
    expect(canvas).toContain("bindIleSurfaceWheelZoom");
    expect(helpers).toContain("export function bindIleSurfaceEditorEvents");
    expect(helpers).not.toContain("requestWindow");
  });
});
