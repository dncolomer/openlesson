import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  detectImportSource,
  parseImportText,
} from "@/lib/evidence-api-demo/parse-import-text";

describe("parse-import-text", () => {
  it("detects skill.md frontmatter as skill source", () => {
    const text = `---
name: acme-crm-openlesson-evidence
description: Acme CRM integration skill
---

# Acme CRM — OpenLesson Evidence
## Purpose
Verify trial workspace setup.`;
    expect(detectImportSource(text)).toBe("skill");
  });

  it("detects MCP tool JSON as mcp source", () => {
    const text = JSON.stringify({
      tools: [
        { name: "list_workspaces", description: "List verification workspaces" },
        { name: "upload_evidence", description: "Upload tool evidence JSON" },
      ],
    });
    expect(detectImportSource(text)).toBe("mcp");
  });

  it("extracts endpoints and integration hints from skill sample", () => {
    const samplePath = join(process.cwd(), "public/pumadoc-evidence-performance-skill.md");
    const text = readFileSync(samplePath, "utf8");
    const hints = parseImportText(text, "skill");

    expect(hints.skillName).toContain("pumadoc");
    expect(hints.endpoints.length).toBeGreaterThan(0);
    expect(hints.integrationName).toBeTruthy();
    expect(hints.evalDefinition?.length).toBeGreaterThan(20);
  });

  it("extracts MCP tools from JSON catalog", () => {
    const text = JSON.stringify({
      tools: [
        { name: "list_blocks", description: "List workspace blocks" },
        { name: "get_ghl_results", description: "Fetch competency results" },
      ],
    });
    const hints = parseImportText(text, "mcp");

    expect(hints.mcpTools).toHaveLength(2);
    expect(hints.mcpTools[0].name).toBe("list_blocks");
  });
});