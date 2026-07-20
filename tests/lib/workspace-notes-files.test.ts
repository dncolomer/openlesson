import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import {
  isInlineNotesMime,
  nextNotesFileName,
  NOTES_FILE_MIME,
  NOTES_FILE_STARTER,
  textToBase64Utf8,
} from "@/lib/workspace-notes-files";

const REPO_ROOT = path.resolve(__dirname, "../..");

describe("nextNotesFileName", () => {
  it("uses notes.md when free", () => {
    expect(nextNotesFileName([])).toBe("notes.md");
    expect(nextNotesFileName([{ file_name: "brief.pdf" }])).toBe("notes.md");
  });

  it("increments when notes.md already exists", () => {
    expect(nextNotesFileName([{ file_name: "notes.md" }])).toBe("notes-2.md");
    expect(
      nextNotesFileName([{ file_name: "notes.md" }, { file_name: "notes-2.md" }]),
    ).toBe("notes-3.md");
  });

  it("is case-insensitive on existing names", () => {
    expect(nextNotesFileName([{ file_name: "Notes.MD" }])).toBe("notes-2.md");
  });
});

describe("isInlineNotesMime", () => {
  it("accepts markdown and plain text", () => {
    expect(isInlineNotesMime("text/markdown")).toBe(true);
    expect(isInlineNotesMime("text/plain")).toBe(true);
    expect(isInlineNotesMime("application/pdf")).toBe(false);
    expect(isInlineNotesMime("image/png")).toBe(false);
  });
});

describe("textToBase64Utf8", () => {
  it("round-trips starter notes content", () => {
    const b64 = textToBase64Utf8(NOTES_FILE_STARTER);
    expect(Buffer.from(b64, "base64").toString("utf8")).toBe(NOTES_FILE_STARTER);
    expect(NOTES_FILE_MIME).toBe("text/markdown");
  });
});

describe("WorkspaceNotesFilesPanel creates separate note files", () => {
  const source = fs.readFileSync(
    path.join(REPO_ROOT, "components/WorkspaceNotesFilesPanel.tsx"),
    "utf8",
  );

  it("creates notes via the files upload API with a unique name", () => {
    expect(source).toContain("createNotesFile");
    expect(source).toContain("nextNotesFileName");
    expect(source).toContain("NOTES_FILE_MIME");
    expect(source).toContain("data-create-notes-file-row");
    expect(source).toContain("/api/workspace/files");
    expect(source).toContain("setEditingFileId");
  });

  it("uses the bottom placeholder card as the only new-notes control", () => {
    expect(source).toMatch(/data-create-notes-file-row[\s\S]*?createNotesFile\(\)/);
    expect(source).not.toContain('data-create-notes-file"');
  });
});
