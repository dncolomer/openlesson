import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  API_WORKSPACE_CREATE_MODES,
  assertApiCreateMode,
  blankWorkspaceCreateOutcome,
  composeBlockGenerationContext,
  composeDantesResourceContext,
  composeFilesGoalCreatePrompt,
  composeTemplateCreatePrompt,
  composeTemplateWorkspaceNotes,
  goalFieldsFromPrompt,
  isApiAllowedCreateMode,
  parseWorkspaceCreateMode,
  isUiWorkspaceCreateMode,
  resolveWorkspaceCreateOverlay,
  UI_WORKSPACE_CREATE_MODES,
} from "@/lib/workspace-create-modes";
import { INITIAL_CHAPTERS_BANDS } from "@/lib/initial-chapters";

describe("workspace create modes", () => {
  it("exposes blank + template as UI modes; files_goal stays API-only", () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual(["blank", "template"]);
    expect(UI_WORKSPACE_CREATE_MODES).not.toContain("files_goal");
    expect(isUiWorkspaceCreateMode("blank")).toBe(true);
    expect(isUiWorkspaceCreateMode("template")).toBe(true);
    expect(isUiWorkspaceCreateMode("files_goal")).toBe(false);
    expect(API_WORKSPACE_CREATE_MODES).toEqual(["files_goal"]);
    expect(isApiAllowedCreateMode("files_goal")).toBe(true);
    expect(isApiAllowedCreateMode("blank")).toBe(false);
    expect(isApiAllowedCreateMode("template")).toBe(false);
  });

  it("blank create yields zero blocks", () => {
    const outcome = blankWorkspaceCreateOutcome();
    expect(outcome.mode).toBe("blank");
    expect(outcome.blocks).toEqual([]);
    expect(outcome.blocks).toHaveLength(0);
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
    expect(prompt).toContain(String(INITIAL_CHAPTERS_BANDS.narrow.target));
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
    expect(prompt).toContain(String(INITIAL_CHAPTERS_BANDS.mid.target));
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

describe("workspace create overlay after blank/template attempt", () => {
  it("keeps overlay on success and restores chooser on failure", () => {
    const blankOk = resolveWorkspaceCreateOverlay({ succeeded: true });
    const templateOk = resolveWorkspaceCreateOverlay({ succeeded: true });
    const blankFail = resolveWorkspaceCreateOverlay({ succeeded: false });
    const templateFail = resolveWorkspaceCreateOverlay({ succeeded: false });

    expect(blankOk.busy).toBe(true);
    expect(templateOk.busy).toBe(true);
    expect(blankFail.busy).toBe(false);
    expect(templateFail.busy).toBe(false);

    mkdirSync(OVERLAY_SCRATCH, { recursive: true });
    writeFileSync(
      join(OVERLAY_SCRATCH, "workspace-create-busy.log"),
      [
        "blank_success_busy=" + blankOk.busy,
        "template_success_busy=" + templateOk.busy,
        "blank_failure_busy=" + blankFail.busy,
        "template_failure_busy=" + templateFail.busy,
        "success_keeps_overlay=" + String(blankOk.busy && templateOk.busy),
        "failure_restores_chooser=" +
          String(!blankFail.busy && !templateFail.busy),
      ].join("\n") + "\n",
      "utf8",
    );
  });
});
