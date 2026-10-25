import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  API_WORKSPACE_CREATE_MODES,
  BLANK_MAP_DEFAULT_TITLE,
  assertApiCreateMode,
  blankWorkspaceCreateOutcome,
  resolveBlankWorkspaceTitle,
  composeBlockGenerationContext,
  composeDantesResourceContext,
  composeFilesGoalCreatePrompt,
  composeTemplateCreatePrompt,
  composeTemplateWorkspaceNotes,
  goalFieldsFromPrompt,
  isApiAllowedCreateMode,
  parseWorkspaceCreateMode,
  isUiWorkspaceCreateMode,
  workspaceCreateModeFromQuery,
  resolveWorkspaceCreateOverlay,
  UI_WORKSPACE_CREATE_MODES,
  workspaceKindForCreateMode,
} from "@/lib/workspace-create-modes";
import { AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE } from "@/lib/workspace-kind";
import { INITIAL_CHAPTERS_BANDS } from "@/lib/initial-chapters";

describe("workspace create modes", () => {
  it("exposes blank as the only UI mode; template and files_goal stay API-only", () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual(["blank"]);
    expect(UI_WORKSPACE_CREATE_MODES).not.toContain("template");
    expect(UI_WORKSPACE_CREATE_MODES).not.toContain("files_goal");
    expect(isUiWorkspaceCreateMode("blank")).toBe(true);
    expect(isUiWorkspaceCreateMode("template")).toBe(false);
    expect(isUiWorkspaceCreateMode("knowledge_region")).toBe(false);
    expect(isUiWorkspaceCreateMode("calibration")).toBe(false);
    expect(isUiWorkspaceCreateMode("files_goal")).toBe(false);
    expect(workspaceCreateModeFromQuery("blank")).toBe("blank");
    expect(workspaceCreateModeFromQuery("template")).toBeNull();
    expect(workspaceCreateModeFromQuery("knowledge_region")).toBeNull();
    expect(workspaceCreateModeFromQuery("calibration")).toBeNull();
    expect(workspaceCreateModeFromQuery("files_goal")).toBeNull();
    expect(API_WORKSPACE_CREATE_MODES).toEqual(["files_goal"]);
    expect(isApiAllowedCreateMode("files_goal")).toBe(true);
    expect(isApiAllowedCreateMode("blank")).toBe(false);
    expect(isApiAllowedCreateMode("template")).toBe(false);
    expect(isApiAllowedCreateMode("knowledge_region")).toBe(false);
    expect(isApiAllowedCreateMode("calibration")).toBe(false);
  });

  it("blank create yields zero blocks", () => {
    const outcome = blankWorkspaceCreateOutcome();
    expect(outcome.mode).toBe("blank");
    expect(outcome.blocks).toEqual([]);
    expect(outcome.blocks).toHaveLength(0);
  });

  it("blank map title defaults to Untitled map", () => {
    expect(BLANK_MAP_DEFAULT_TITLE).toBe("Untitled map");
    expect(resolveBlankWorkspaceTitle("")).toBe("Untitled map");
    expect(resolveBlankWorkspaceTitle("   ")).toBe("Untitled map");
    expect(resolveBlankWorkspaceTitle(null)).toBe("Untitled map");
    expect(resolveBlankWorkspaceTitle("Linear Algebra")).toBe("Linear Algebra");
    expect(resolveBlankWorkspaceTitle("x".repeat(200))).toHaveLength(120);
  });

  it("knowledge region create is a UI mode, yields zero blocks, and is not API-only", () => {
    expect(parseWorkspaceCreateMode("knowledge_region")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("knowledge-region")).toBe("knowledge_region");
    expect(parseWorkspaceCreateMode("knowledgeRegion")).toBe("knowledge_region");
    expect(workspaceKindForCreateMode("knowledge_region")).toBe("knowledge_region");
    expect(assertApiCreateMode("knowledge_region").ok).toBe(false);
    expect(AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE).toContain("/api/dashboard/flows");
  });

  it("calibration create is a UI mode, yields zero blocks, and persists the calibration kind", () => {
    expect(parseWorkspaceCreateMode("calibration")).toBe("calibration");
    expect(parseWorkspaceCreateMode("calibrate")).toBe("calibration");
    expect(parseWorkspaceCreateMode("calibration_workspace")).toBe("calibration");
    expect(workspaceKindForCreateMode("calibration")).toBe("calibration");
    expect(workspaceKindForCreateMode("knowledge_region")).toBe("knowledge_region");
    expect(assertApiCreateMode("calibration").ok).toBe(false);
    expect(AGENT_WORKSPACE_CREATE_REFUSED_MESSAGE).toContain("/api/dashboard/flows");
  });

  it("template path composes topic resources + starting size into generate input", () => {
    const dantes = composeDantesResourceContext("Linear Algebra", [
      { title: "3Blue1Brown Essence", type: "video", description: "Visual intro" },
      { title: "Gilbert Strang", type: "course", url: "https://example.com" },
    ]);
    expect(dantes).toContain("Linear Algebra");
    expect(dantes).toContain("3Blue1Brown Essence");
    expect(dantes).toContain("Gilbert Strang");

    const prompt = composeTemplateCreatePrompt({
      topicName: "Linear Algebra",
      dantesContext: dantes,
      initialChapters: "narrow",
    });
    expect(prompt).toContain("Linear Algebra");
    expect(prompt).toContain("3Blue1Brown");
    expect(prompt).toContain(String(INITIAL_CHAPTERS_BANDS.random_sparse.target));
    expect(prompt).toMatch(/position_x|grid|spatial|origin/i);
  });

  it("template notes persist resource links for the workspace Notes tab / later AI context", () => {
    const notes = composeTemplateWorkspaceNotes(
      "Linear Algebra",
      [
        {
          title: "3Blue1Brown Essence",
          type: "video",
          url: "https://example.com/essence",
          description: "Visual intro",
        },
        { title: "Gilbert Strang", type: "course", url: "https://ocw.mit.edu/strang" },
      ],
      { topicDescription: "Foundations of linear algebra" },
    );
    expect(notes).toContain("# Linear Algebra");
    expect(notes).toContain("Foundations of linear algebra");
    expect(notes).toContain("## Resource links");
    expect(notes).toContain("[3Blue1Brown Essence](https://example.com/essence)");
    expect(notes).toContain("[Gilbert Strang](https://ocw.mit.edu/strang)");
    expect(notes).toContain("Visual intro");
    // Empty selection still yields durable notes shell
    const empty = composeTemplateWorkspaceNotes("Empty Topic", []);
    expect(empty).toContain("# Empty Topic");
    expect(empty).toMatch(/No resources were selected/i);
  });

  it("files+goal path treats prompt as Goal (persisted fields + generate language)", () => {
    const goalPrompt = "Ship a verified onboarding flow for enterprise sales";
    const fields = goalFieldsFromPrompt(goalPrompt);
    expect(fields.goal).toBe(goalPrompt);
    expect(fields.workspace_goal).toBe(goalPrompt);
    expect(fields.notes).toBe(goalPrompt);
    expect(fields.root_topic).toContain("Ship a verified");

    const prompt = composeFilesGoalCreatePrompt({
      goalPrompt,
      initialChapters: "mid",
      fileContext: "\nAttached: playbook.pdf",
    });
    expect(prompt).toContain(goalPrompt);
    expect(prompt).toMatch(/GOAL|goal/i);
    expect(prompt).toContain("playbook.pdf");
    expect(prompt).toContain(String(INITIAL_CHAPTERS_BANDS.islands.target));
  });

  it("API create entry rejects blank/template and accepts files_goal", () => {
    expect(assertApiCreateMode("blank")).toEqual({
      ok: false,
      error: expect.stringMatching(/files_goal|Files \+ Goal/i) as unknown as string,
    });
    expect(assertApiCreateMode("template").ok).toBe(false);
    expect(assertApiCreateMode("files_goal")).toEqual({ ok: true });
    expect(assertApiCreateMode(undefined)).toEqual({ ok: true });
    expect(assertApiCreateMode(null)).toEqual({ ok: true });
    expect(parseWorkspaceCreateMode("files+goal")).toBe("files_goal");
  });

  it("block generation context always includes files and notes when provided", () => {
    const ctx = composeBlockGenerationContext({
      workspaceTitle: "Ops Map",
      goal: "Reduce ticket time",
      notes: "Focus on triage first",
      fileNames: ["runbook.md", "sla.pdf"],
    });
    expect(ctx).toContain("Ops Map");
    expect(ctx).toContain("Reduce ticket time");
    expect(ctx).toContain("Focus on triage first");
    expect(ctx).toContain("runbook.md");
    expect(ctx).toContain("sla.pdf");
    expect(ctx).toMatch(/files always in context/i);
  });
});

const OVERLAY_SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-1caf392ccbf2/implementer";

describe("workspace create overlay after blank attempt", () => {
  it("keeps overlay on success and restores retry on failure", () => {
    const blankOk = resolveWorkspaceCreateOverlay({ succeeded: true });
    const blankFail = resolveWorkspaceCreateOverlay({ succeeded: false });

    expect(blankOk.busy).toBe(true);
    expect(blankFail.busy).toBe(false);

    mkdirSync(OVERLAY_SCRATCH, { recursive: true });
    writeFileSync(
      join(OVERLAY_SCRATCH, "workspace-create-busy.log"),
      [
        "blank_success_busy=" + blankOk.busy,
        "blank_failure_busy=" + blankFail.busy,
        "success_keeps_overlay=" + String(blankOk.busy),
        "failure_restores_retry=" + String(!blankFail.busy),
      ].join("\n") + "\n",
      "utf8",
    );
  });
});
