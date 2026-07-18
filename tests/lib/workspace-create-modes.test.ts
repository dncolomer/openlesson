import { describe, expect, it } from "vitest";
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
  UI_WORKSPACE_CREATE_MODES,
} from "@/lib/workspace-create-modes";
import { INITIAL_CHAPTERS_BANDS } from "@/lib/initial-chapters";

describe("workspace create modes", () => {
  it("exposes three UI modes and API-only files_goal", () => {
    expect(UI_WORKSPACE_CREATE_MODES).toEqual(["blank", "template", "files_goal"]);
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
    expect(fields.conversion_goal).toBe(goalPrompt);
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
