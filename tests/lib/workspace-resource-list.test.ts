import { describe, expect, it } from "vitest";
import { buildWorkspaceResourceList } from "@/lib/workspace-resource-list";

describe("buildWorkspaceResourceList", () => {
  const sampleFiles = [
    {
      id: "f1",
      file_name: "brief.pdf",
      file_size: 1024,
      mime_type: "application/pdf",
      created_at: "2026-01-01T00:00:00.000Z",
    },
    {
      id: "f2",
      file_name: "shot.png",
      file_size: 2048,
      mime_type: "image/png",
      created_at: "2026-01-02T00:00:00.000Z",
    },
  ];

  it("places notes as the first list item then each file as its own row", () => {
    const list = buildWorkspaceResourceList({
      notes: "Hello **world**",
      files: sampleFiles,
    });

    expect(list).toHaveLength(3);
    expect(list[0]).toEqual({
      kind: "notes",
      id: "notes",
      content: "Hello **world**",
    });
    expect(list[1]).toMatchObject({ kind: "file", id: "f1", file_name: "brief.pdf" });
    expect(list[2]).toMatchObject({ kind: "file", id: "f2", file_name: "shot.png" });
  });

  it("always includes a notes row even when notes are empty", () => {
    const list = buildWorkspaceResourceList({ notes: "", files: [] });
    expect(list).toEqual([{ kind: "notes", id: "notes", content: "" }]);
  });

  it("can omit files for AYCL-style notes-only surfaces", () => {
    const list = buildWorkspaceResourceList({
      notes: "only notes",
      files: sampleFiles,
      includeFiles: false,
    });
    expect(list).toEqual([{ kind: "notes", id: "notes", content: "only notes" }]);
  });

  it("can omit notes when includeNotes is false", () => {
    const list = buildWorkspaceResourceList({
      notes: "ignored",
      files: sampleFiles,
      includeNotes: false,
    });
    expect(list.every((item) => item.kind === "file")).toBe(true);
    expect(list).toHaveLength(2);
  });
});
