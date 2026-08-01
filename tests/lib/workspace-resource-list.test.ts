import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildWorkspaceResourceList,
  filterWorkspaceResourceList,
  normalizeResourceTypeFilter,
  nextResourceTypeFilter,
} from "@/lib/workspace-resource-list";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.CONTEXT_LIST_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-d397f0bc9d45/implementer";

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

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

  it("places notes then files when no external sources", () => {
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

  it("places external sources above notes", () => {
    const list = buildWorkspaceResourceList({
      notes: "notes body",
      files: sampleFiles,
      externalResources: [
        {
          id: "e1",
          workspace_id: "ws",
          title: "Link",
          url: "https://example.com",
          resource_type: "website",
          description: null,
          source: "link",
          dantes_topic_slug: null,
          meta: {},
          sort_order: 0,
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    expect(list[0]).toMatchObject({ kind: "external", id: "e1" });
    expect(list[1]).toMatchObject({ kind: "notes" });
    expect(list[2]).toMatchObject({ kind: "file" });
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

describe("filterWorkspaceResourceList", () => {
  const inventory = buildWorkspaceResourceList({
    notes: "Bayesian priors and posteriors",
    files: [
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
    ],
    externalResources: [
      {
        id: "e1",
        workspace_id: "ws",
        title: "Wikipedia Bayes",
        url: "https://en.wikipedia.org/wiki/Bayes",
        resource_type: "website",
        description: null,
        source: "link",
        dantes_topic_slug: null,
        meta: {},
        sort_order: 0,
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ],
  });

  it("empty query + type=all → full set", () => {
    const out = filterWorkspaceResourceList(inventory, { query: "", typeFilter: "all" });
    expect(out).toHaveLength(inventory.length);
    expect(out.map((i) => i.kind)).toEqual(["external", "notes", "file", "file"]);
  });

  it("query matches a file name only", () => {
    const out = filterWorkspaceResourceList(inventory, { query: "brief.pdf" });
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ kind: "file", file_name: "brief.pdf" });
  });

  it("type=external → only links", () => {
    const out = filterWorkspaceResourceList(inventory, { typeFilter: "external" });
    expect(out.every((i) => i.kind === "external")).toBe(true);
    expect(out).toHaveLength(1);
  });

  it("type=files|notes with query → intersection", () => {
    const filesOnly = filterWorkspaceResourceList(inventory, {
      typeFilter: "files",
      query: "shot",
    });
    expect(filesOnly).toHaveLength(1);
    expect(filesOnly[0]).toMatchObject({ kind: "file", file_name: "shot.png" });

    const notesOnly = filterWorkspaceResourceList(inventory, {
      typeFilter: "notes",
      query: "Bayesian",
    });
    expect(notesOnly).toHaveLength(1);
    expect(notesOnly[0].kind).toBe("notes");
  });

  it("no matches → empty without throwing", () => {
    expect(
      filterWorkspaceResourceList(inventory, { query: "zzzz-no-match" }),
    ).toEqual([]);
    expect(
      filterWorkspaceResourceList(inventory, {
        typeFilter: "external",
        query: "shot.png",
      }),
    ).toEqual([]);
  });

  it("normalize + next type filter chips", () => {
    expect(normalizeResourceTypeFilter("links")).toBe("external");
    expect(normalizeResourceTypeFilter("file")).toBe("files");
    expect(nextResourceTypeFilter("all", "notes")).toBe("notes");
    expect(nextResourceTypeFilter("notes", "notes")).toBe("all");

    writeEvidence(
      "context-list-filter.log",
      [
        "full=" +
          filterWorkspaceResourceList(inventory, { query: "", typeFilter: "all" }).length,
        "fileQuery=" +
          filterWorkspaceResourceList(inventory, { query: "brief.pdf" }).length,
        "externalOnly=" +
          filterWorkspaceResourceList(inventory, { typeFilter: "external" }).length,
        "empty=" +
          filterWorkspaceResourceList(inventory, { query: "zzzz" }).length,
      ].join("\n"),
    );
  });
});

describe("structural: compact Context list + search/type filters", () => {
  it("WorkspaceNotesFilesPanel wires search, type filters, compact rows", () => {
    const panel = read("components/WorkspaceNotesFilesPanel.tsx");
    expect(panel).toContain("data-resource-list-toolbar");
    expect(panel).toContain("data-resource-list-search");
    expect(panel).toContain("data-resource-type-filters");
    expect(panel).toContain("data-resource-type-filter=");
    expect(panel).toContain("filterWorkspaceResourceList");
    expect(panel).toContain("filteredItems");
    expect(panel).toContain("data-resource-list-compact");
    expect(panel).toContain("data-resource-row-compact");
    // Compact row chrome (not oversized py-3 cards for closed rows)
    expect(panel).toMatch(/px-2 py-1/);
    expect(panel).not.toMatch(/data-resource-row="external"[\s\S]{0,80}px-4 py-3/);

    writeEvidence(
      "context-list-ui.log",
      [
        "search=" + panel.includes("data-resource-list-search"),
        "typeFilters=" + panel.includes("data-resource-type-filters"),
        "compactList=" + panel.includes("data-resource-list-compact"),
        "filterHelper=" + panel.includes("filterWorkspaceResourceList"),
      ].join("\n"),
    );
  });
});
