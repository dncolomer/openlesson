/**
 * ILE live-session dead frontend: retired submit buttons, Thought Memory host,
 * and empty Global-resources tools grid must stay gone. TAP keeps I'm done answering.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { readSessionViewSurface } from "@/tests/helpers/surface-source";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-7b5be2be6813/implementer";

function read(rel: string) {
  expect(existsSync(join(ROOT, rel)), `missing ${rel}`).toBe(true);
  return readFileSync(join(ROOT, rel), "utf8");
}

function writeScratch(name: string, body: string) {
  mkdirSync(SCRATCH, { recursive: true });
  writeFileSync(join(SCRATCH, name), body, "utf8");
}

describe("ILE dead frontend is gone from the live session", () => {
  it("does not mount retired ILE submit/thought hosts or an empty tools grid; TAP keeps I'm done answering", () => {
    const panes = read("components/session-view/session-tool-panes.tsx");
    const chrome = read("components/session-view/session-chrome.tsx");
    const tools = read("components/ToolsPanel.tsx");
    const view = readSessionViewSurface();
    const canvas = read("components/ExcalidrawCanvas.tsx");
    const tapPhases = read("components/tap-score/tap-score-phases.tsx");
    const tapShell = read("components/exercise-tap/ExerciseTapShell.tsx");

    expect(panes).not.toContain("NotebookSubmitButton");
    expect(panes).not.toContain("onSubmitToHelios");
    expect(panes).not.toContain("ThoughtMemoryPanel");
    expect(panes).toContain("IleReviewWorkPanel");
    expect(existsSync(join(ROOT, "components/session/NotebookSubmitButton.tsx"))).toBe(
      false,
    );

    expect(chrome).not.toContain("<ToolsPanel");
    expect(tools).not.toContain("export function ToolsPanel");
    expect(tools).not.toContain("data-ile-tools-grid");
    expect(tools).not.toContain("const mainTools");
    expect(chrome).toContain("data-ile-tools-widget");
    expect(chrome).toContain("data-ile-sensor-pair");

    const dock = read("components/session-view/ile-work-dock-bar.tsx");
    expect(dock).not.toContain("data-ile-global-resources");
    expect(chrome).toContain("data-ile-global-resources");
    expect(view).toContain("IleSubmitWorkButton");
    expect(read("components/SessionView.tsx")).not.toContain("data-ile-review-work");
    expect(read("components/session-view/ile-work-dock-bar.tsx")).not.toContain(
      "data-ile-review-work",
    );
    expect(view).not.toContain("I'm Done Writing");
    expect(view).not.toContain("I'm Done Drawing");

    expect(canvas).toContain("onSubmitToHelios &&");

    expect(tapPhases).toContain("ImDoneAnsweringControl");
    expect(tapShell).toContain("ImDoneAnsweringControl");
    expect(tapPhases).toContain("ThoughtMemoryPanel");
    expect(tapShell).toContain("ThoughtMemoryPanel");

    writeScratch(
      "ile-quality-dead-frontend.txt",
      [
        "ILE panes: no NotebookSubmitButton, no ThoughtMemoryPanel, IleReviewWorkPanel",
        "no ToolsPanel empty grid; sensors remain on data-ile-tools-widget",
        "Global resources lives on the PoW bar next to Insights",
        "TAP: ImDoneAnsweringControl + ThoughtMemoryPanel kept",
      ].join("\n"),
    );
  });
});
