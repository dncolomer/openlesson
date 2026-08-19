import { readWorkspaceViewSurface } from "@/tests/helpers/surface-source";
/**
 * External Context resources: pure normalize/CRUD helpers + list order + wiring.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  applyExternalResourceUpdate,
  deleteExternalResourceFromList,
  externalResourceFromDantes,
  normalizeExternalResourceCreate,
  normalizeExternalResourceList,
  normalizeExternalResourceRow,
  upsertExternalResourceInList,
  type WorkspaceExternalResource,
} from "@/lib/workspace-external-resources";
import {
  buildWorkspaceResourceList,
  externalResourcesAboveNotes,
} from "@/lib/workspace-resource-list";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.CONTEXT_DANTES_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-0d2042848f32/implementer";

function read(rel: string) {
  return readFileSync(join(ROOT, rel), "utf8");
}

function ensureScratch() {
  try {
    mkdirSync(SCRATCH, { recursive: true });
  } catch {
    /* optional */
  }
}

const sampleExternal: WorkspaceExternalResource = {
  id: "e1",
  workspace_id: "ws1",
  title: "3Blue1Brown Essence of Linear Algebra",
  url: "https://www.youtube.com/playlist?list=PLZHQObOWTQDPD3MizzM2xVFitgF8hE_ab",
  resource_type: "video",
  description: "Visual LA intro",
  source: "dantes",
  dantes_topic_slug: "linear-algebra",
  meta: { difficulty: "beginner" },
  sort_order: 0,
  created_at: "2026-07-31T00:00:00.000Z",
};

describe("normalizeExternalResourceCreate", () => {
  it("accepts Dantes and link payloads; rejects bad URLs", () => {
    const dantes = normalizeExternalResourceCreate(
      externalResourceFromDantes({
        title: "Gilbert Strang",
        url: "https://ocw.mit.edu/courses/linear-algebra",
        type: "course",
        description: "MIT OCW",
        topicSlug: "linear-algebra",
      }),
    );
    expect(dantes).toMatchObject({
      title: "Gilbert Strang",
      url: "https://ocw.mit.edu/courses/linear-algebra",
      source: "dantes",
      dantes_topic_slug: "linear-algebra",
      resource_type: "course",
    });

    const link = normalizeExternalResourceCreate({
      url: "https://example.com/doc",
      source: "link",
    });
    expect(link?.title).toBe("example.com");
    expect(link?.source).toBe("link");

    expect(normalizeExternalResourceCreate({ url: "not-a-url" })).toBeNull();
    expect(normalizeExternalResourceCreate({ title: "x" })).toBeNull();
  });
});

describe("list order: external above notes", () => {
  it("places external sources above notes and files", () => {
    const list = buildWorkspaceResourceList({
      notes: "Workspace notes body",
      files: [
        {
          id: "f1",
          file_name: "brief.pdf",
          file_size: 10,
          mime_type: "application/pdf",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      externalResources: [
        sampleExternal,
        {
          ...sampleExternal,
          id: "e2",
          title: "Strang OCW",
          url: "https://ocw.mit.edu/18-06",
          source: "create",
          sort_order: 1,
        },
      ],
    });

    expect(list[0]).toMatchObject({ kind: "external", id: "e1" });
    expect(list[1]).toMatchObject({ kind: "external", id: "e2" });
    expect(list[2]).toMatchObject({ kind: "notes", id: "notes" });
    expect(list[3]).toMatchObject({ kind: "file", id: "f1" });
    expect(externalResourcesAboveNotes(list)).toBe(true);

    ensureScratch();
    try {
      writeFileSync(
        join(SCRATCH, "context-external-resources-list.txt"),
        list
          .map((item) => {
            if (item.kind === "external") {
              return `external\t${item.resource.title}\t${item.resource.url}`;
            }
            if (item.kind === "notes") return `notes\t${item.content.slice(0, 40)}`;
            return `file\t${item.file_name}`;
          })
          .join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });
});

describe("pure CRUD field shapes", () => {
  it("create → update → delete round-trip through real helpers", () => {
    const created = normalizeExternalResourceCreate({
      title: "Docs",
      url: "https://docs.example.com/a",
      source: "link",
      description: "API docs",
    });
    expect(created).not.toBeNull();

    let list: WorkspaceExternalResource[] = [];
    const row = normalizeExternalResourceRow({
      id: "new-1",
      workspace_id: "ws1",
      ...created,
      created_at: "2026-07-31T12:00:00.000Z",
    });
    expect(row).not.toBeNull();
    list = upsertExternalResourceInList(list, row!);
    expect(list).toHaveLength(1);

    const updated = applyExternalResourceUpdate(row!, {
      title: "Docs v2",
      url: "https://docs.example.com/b",
    });
    expect(updated?.title).toBe("Docs v2");
    list = upsertExternalResourceInList(list, updated!);
    expect(list[0].title).toBe("Docs v2");

    list = deleteExternalResourceFromList(list, "new-1");
    expect(list).toEqual([]);

    const normalizedList = normalizeExternalResourceList([
      { id: "z", workspace_id: "ws", title: "Z", url: "https://z.example", sort_order: 2 },
      { id: "a", workspace_id: "ws", title: "A", url: "https://a.example", sort_order: 0 },
    ]);
    expect(normalizedList.map((r) => r.id)).toEqual(["a", "z"]);

    ensureScratch();
    try {
      writeFileSync(
        join(SCRATCH, "context-external-resources-crud.log"),
        [
          "create ok",
          JSON.stringify(created),
          "update ok",
          JSON.stringify(updated),
          "delete ok",
          "list empty after delete",
        ].join("\n"),
        "utf8",
      );
    } catch {
      /* optional */
    }
  });
});

describe("structural: Context Dantes + no map prompt-impact", () => {
  it("Context hosts Dantes + add-link; map drops How context shapes practice", () => {
    expect(existsSync(join(ROOT, "lib/workspace-external-resources.ts"))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspaceContextPanel.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspaceDantesSearch.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "components/WorkspaceExternalAddLinkForm.tsx"))).toBe(true);
    expect(existsSync(join(ROOT, "app/api/workspace/external-resources/route.ts"))).toBe(true);
    expect(
      existsSync(
        join(ROOT, "supabase/migrations/20260731200000_workspace_external_resources.sql"),
      ),
    ).toBe(true);

    const view = readWorkspaceViewSurface();
    expect(view).toContain("WorkspaceContextPanel");
    expect(view).toContain("data-workspace-context-section");
    expect(view).not.toContain("WorkspacePromptImpactPanel");
    expect(view).not.toContain("How context shapes practice");

    const mapAuth = read("components/WorkspaceMapAuthoringPane.tsx");
    expect(mapAuth).not.toContain("WorkspacePromptImpactPanel");
    expect(mapAuth).not.toContain("How context shapes practice");
    expect(mapAuth).toContain("data-workspace-map-authoring-pane");

    const context = read("components/WorkspaceContextPanel.tsx");
    expect(context).toContain("WorkspaceDantesSearch");
    expect(context).toContain("WorkspaceExternalAddLinkForm");
    expect(context).toContain("externalResources");
    expect(context).toContain("/api/workspace/external-resources");

    const notes = read("components/WorkspaceNotesFilesPanel.tsx");
    expect(notes).toContain('data-resource-kind="external"');
    expect(notes).toContain("data-external-delete");
    expect(notes).toContain("externalResources");

    const gen = read("app/api/workspace/generate/route.ts");
    expect(gen).toContain("workspace_external_resources");
    expect(gen).toContain("templateExternalCreates");
    expect(gen).toContain("source: \"create\"");
    // Dual-write notes still receive selected resourceItems (not empty []).
    expect(gen).toMatch(/composeTemplateWorkspaceNotes\(\s*topicName,\s*resourceItems/);

    const api = read("app/api/workspace/external-resources/route.ts");
    // Public workspace viewers can list (owner OR is_public), like files GET.
    expect(api).toContain("is_public");
    expect(api).toContain("requireAuthenticatedUser");
    expect(api).toMatch(/plan\.user_id !== user\.id && !plan\.is_public/);
  });
});
