import { describe, expect, it } from "vitest";
import {
  isInlineNotesMime,
  nextNotesFileName,
  NOTES_FILE_MIME,
  NOTES_FILE_STARTER,
  textToBase64Utf8,
} from "@/lib/workspace-notes-files";

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


