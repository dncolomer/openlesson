/**
 * One workspace shell from kind, authoring, and practice-only access.
 * The view calls that policy and does not keep a second learner/creator label.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readWorkspaceViewSurface } from "../helpers/surface-source";
import { workspaceShell } from "@/lib/workspace-mode";

const ROOT = join(__dirname, "../..");

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

const LEARNING_AUTHOR_SECTIONS = [
  "workspace",
  "dags",
  "map_types",
  "context",
  "settings",
] as const;

const VERIFICATION_SECTIONS = [
  "goals",
  "verification_flows",
  "calibration_flows",
  "context",
  "knowledge",
  "settings",
] as const;

describe("workspace shell policy", () => {
  it("gives a learning author authoring drawers and a practice drawer", () => {
    const shell = workspaceShell({
      kind: "standard",
      authoring: true,
      practiceOnly: false,
      isOwner: true,
      isLoggedIn: true,
    });
    expect(shell.sections).toEqual([...LEARNING_AUTHOR_SECTIONS]);
    expect(shell.authoringDrawers).toBe(true);
    expect(shell.practiceDrawer).toBe(true);
    expect(shell.learnerSurface).toBe(false);
    expect(shell.learnerActivity).toBe(true);
    expect(shell.knowledgeLwmEmbeddingsOnly).toBe(false);
  });

  it("keeps a play-only map on the map without authoring", () => {
    const shell = workspaceShell({
      kind: "standard",
      authoring: false,
      practiceOnly: false,
      isOwner: false,
      isLoggedIn: true,
    });
    expect(shell.sections).toEqual(["workspace"]);
    expect(shell.authoringDrawers).toBe(false);
    expect(shell.practiceDrawer).toBe(true);
    expect(shell.learnerSurface).toBe(true);
    expect(shell.learnerActivity).toBe(true);
    expect(shell.knowledgeLwmEmbeddingsOnly).toBe(true);
  });

  it("keeps verification on its own shell", () => {
    const shell = workspaceShell({
      kind: "knowledge_region",
      authoring: false,
      practiceOnly: false,
      isOwner: true,
      isLoggedIn: true,
    });
    expect(shell.sections).toEqual([...VERIFICATION_SECTIONS]);
    expect(shell.authoringDrawers).toBe(true);
    expect(shell.practiceDrawer).toBe(false);
    expect(shell.learnerSurface).toBe(false);
    expect(shell.learnerActivity).toBe(false);
    expect(shell.knowledgeLwmEmbeddingsOnly).toBe(false);
  });

  it("keeps practice-only All-you-can-learn on the learner shell, including verification", () => {
    const shell = workspaceShell({
      kind: "knowledge_region",
      authoring: false,
      practiceOnly: true,
      isOwner: false,
      isLoggedIn: true,
    });
    expect(shell.sections).toEqual([]);
    expect(shell.sections).not.toContain("workspace");
    expect(shell.authoringDrawers).toBe(false);
    expect(shell.practiceDrawer).toBe(true);
    expect(shell.learnerSurface).toBe(true);
    expect(shell.learnerActivity).toBe(true);
    expect(shell.knowledgeLwmEmbeddingsOnly).toBe(true);

    const privileged = workspaceShell({
      kind: "knowledge_region",
      authoring: false,
      practiceOnly: true,
      isOwner: true,
      isLoggedIn: true,
    });
    expect(privileged.sections).toEqual([...VERIFICATION_SECTIONS]);
    expect(privileged.authoringDrawers).toBe(false);
    expect(privileged.practiceDrawer).toBe(true);
    expect(privileged.learnerSurface).toBe(true);
  });

  it("does not keep a second learner/creator label beside the policy", () => {
    const view = readWorkspaceViewSurface();
    const nav = read("components/WorkspaceSectionNav.tsx");
    const mode = read("lib/workspace-mode.ts");
    expect(view).toContain("workspaceShell(");
    expect(view).not.toContain("resolveFixedWorkspaceInteractionMode");
    expect(view).not.toContain("resolveWorkspaceModeShell");
    expect(view).not.toContain("mountsCreatorAuthoringDrawers");
    expect(view).not.toContain("mountsLearnerPracticeDrawer");
    expect(view).not.toContain("data-workspace-interaction-mode");
    expect(view).not.toContain("workspaceEmptyCellOpensAuthoring");
    expect(view).not.toContain("workspaceExpandMapTitle");
    expect(nav).not.toContain("data-workspace-interaction-mode");
    expect(mode).toContain("export function workspaceShell");
    expect(mode).not.toContain("function workspaceEmptyCellOpensAuthoring");
    expect(mode).not.toContain("function workspaceExpandMapTitle");
  });
});
