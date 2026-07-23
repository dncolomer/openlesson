import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { execFileSync } from "node:child_process";

const root = join(__dirname, "../..");
const docxPath = join(root, "docs/sales/self-service-take-home-assignment.docx");
const buildScript = join(root, "docs/sales/build-self-service-take-home-docx.mjs");

function extractDocxText(path: string): string {
  // Drive real package: unzip word/document.xml via system unzip + strip tags
  const xml = execFileSync("unzip", ["-p", path, "word/document.xml"], {
    encoding: "utf8",
    maxBuffer: 10 * 1024 * 1024,
  });
  return xml
    .replace(/<\/w:p>/g, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#x2019;/g, "'")
    .replace(/&#x201C;/g, '"')
    .replace(/&#x201D;/g, '"');
}

describe("Self-service Take-Home Assignment docx", () => {
  it("ships a non-empty Word package with OOXML parts", () => {
    expect(existsSync(buildScript)).toBe(true);
    expect(existsSync(docxPath)).toBe(true);
    const st = statSync(docxPath);
    expect(st.size).toBeGreaterThan(5000);

    const listing = execFileSync("unzip", ["-l", docxPath], { encoding: "utf8" });
    expect(listing).toContain("word/document.xml");
    expect(listing).toContain("[Content_Types].xml");

    // ZIP magic
    const buf = readFileSync(docxPath);
    expect(buf[0]).toBe(0x50); // P
    expect(buf[1]).toBe(0x4b); // K
  });

  it("extracts title and major section anchors from the real docx", () => {
    const text = extractDocxText(docxPath);
    expect(text).toContain("Self-service Take-Home Assignment");
    expect(text).toMatch(/In One line/i);
    expect(text.toLowerCase()).toContain("multi-block");
    expect(text).toContain("Interactive discussion");
    expect(text).toContain("Inputs");
    expect(text).toContain("Candidate experience");
    expect(text).toContain("Job-position report");
    expect(text.toLowerCase()).toMatch(/not viable before/);
    expect(text.toLowerCase()).toMatch(/hire a lot/);
    expect(text).toContain("Uncertain Systems");
    expect(text).toMatch(/strengths and weaknesses/i);
    expect(text).toMatch(/Early Self-Service Screening/);
  });
});

const screeningDocx = join(root, "docs/sales/early-self-service-screening.docx");
const screeningBuild = join(root, "docs/sales/build-early-self-service-screening-docx.mjs");

describe("Early Self-Service Screening docx", () => {
  it("ships a non-empty Word package with OOXML parts", () => {
    expect(existsSync(screeningBuild)).toBe(true);
    expect(existsSync(screeningDocx)).toBe(true);
    expect(statSync(screeningDocx).size).toBeGreaterThan(5000);
    const listing = execFileSync("unzip", ["-l", screeningDocx], { encoding: "utf8" });
    expect(listing).toContain("word/document.xml");
  });

  it("extracts title and major section anchors from the real docx", () => {
    const text = extractDocxText(screeningDocx);
    expect(text).toContain("Early Self-Service Screening");
    expect(text).toMatch(/In One line/i);
    expect(text).toMatch(/15-minute|~15 minute/i);
    expect(text).toContain("Think Aloud Protocol");
    expect(text).toContain("Inputs required");
    expect(text).toContain("Job description");
    expect(text).toContain("Integration (API)");
    expect(text).toContain("Candidate experience");
    expect(text).toContain("Job-position report");
    expect(text.toLowerCase()).toMatch(/hire a lot/);
    expect(text).toMatch(/Placement Option/i);
    expect(text).toContain("Uncertain Systems");
    expect(text.toLowerCase()).toMatch(/does not look at the applicants cv|applicants cv/);
  });
});
