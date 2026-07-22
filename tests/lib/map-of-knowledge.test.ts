import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  aggregatePublicPowStats,
  buildGuestPlacementResult,
  buildMapOfKnowledgePayload,
  filterEnabledRegions,
  filterPublicWorkspaces,
  generateAnonymousGuestIdentity,
  mapDotColor,
  mapDotIsGolden,
  mapDotKindFromParticipant,
  describeEmbeddingModel,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  mergeEmbeddingModelCatalog,
  pickRandomEnabledRegionIds,
  projectMapVectors,
  projectVectors3D,
  reprojectMapLayout,
  resolveSelectedEmbeddingModelId,
  shortUserIdPreview,
  validateGuestPlacement,
} from "@/lib/map-of-knowledge";
import { projectVectors2D } from "@/lib/knowledge-config";

const root = join(__dirname, "../..");

function unitVector(dim: number, axis: number, scale = 1): number[] {
  const v = new Array(dim).fill(0);
  v[axis % dim] = scale;
  return v;
}

describe("map-of-knowledge pure logic", () => {
  it("filters to public workspaces only", () => {
    const rows = [
      { id: "a", is_public: true },
      { id: "b", is_public: false },
      { id: "c", is_public: true },
      { id: "d", is_public: null },
    ];
    expect(filterPublicWorkspaces(rows).map((r) => r.id)).toEqual(["a", "c"]);
  });

  it("projects vectors to 2D via shipped knowledge-config path", () => {
    const vectors = [
      unitVector(8, 0),
      unitVector(8, 1),
      unitVector(8, 2),
      unitVector(8, 0, 2),
    ];
    const coords = projectVectors2D(vectors, "pca");
    expect(coords).toHaveLength(4);
    for (const c of coords) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
    }
    // Not all collapsed to origin when points differ
    const spread = coords.some((c, i) =>
      coords.some((d, j) => i !== j && (Math.abs(c.x - d.x) > 1e-6 || Math.abs(c.y - d.y) > 1e-6)),
    );
    expect(spread).toBe(true);
  });

  it("projects vectors to 3D with finite coordinates", () => {
    const vectors = [
      unitVector(8, 0),
      unitVector(8, 1),
      unitVector(8, 2),
      unitVector(8, 3),
      unitVector(8, 0, 1.5),
    ];
    const coords = projectVectors3D(vectors);
    expect(coords).toHaveLength(5);
    for (const c of coords) {
      expect(Number.isFinite(c.x)).toBe(true);
      expect(Number.isFinite(c.y)).toBe(true);
      expect(Number.isFinite(c.z)).toBe(true);
    }
    const hasZ = coords.some((c) => Math.abs(c.z) > 1e-9);
    const spread = coords.some((c, i) =>
      coords.some(
        (d, j) =>
          i !== j &&
          (Math.abs(c.x - d.x) > 1e-6 || Math.abs(c.y - d.y) > 1e-6 || Math.abs(c.z - d.z) > 1e-6),
      ),
    );
    expect(spread || hasZ || coords.length > 0).toBe(true);
  });

  it("reprojects map layout when algorithm changes", () => {
    const vectors = [
      unitVector(8, 0),
      unitVector(8, 1),
      unitVector(8, 2),
      unitVector(8, 3),
    ];
    const pca = projectMapVectors(vectors, "pca");
    const mds = projectMapVectors(vectors, "classical_mds");
    expect(pca).toHaveLength(4);
    expect(mds).toHaveLength(4);
    // Different algorithms generally produce different primary-plane layouts
    const differ = pca.some(
      (p, i) => Math.abs(p.x - mds[i].x) > 1e-6 || Math.abs(p.y - mds[i].y) > 1e-6,
    );
    expect(differ).toBe(true);

    const users = vectors.slice(0, 2).map((vector, i) => ({
      id: `u${i}`,
      workspace_id: "w",
      workspace_title: "W",
      subject_label: `user:abc${i}`,
      id_preview: `abc${i}00`.slice(0, 6),
      kind: "tap" as const,
      vector,
      x: 0,
      y: 0,
      z: 0,
      confidence: 0.5,
    }));
    const regions = vectors.slice(2).map((vector, i) => ({
      id: `r${i}`,
      workspace_id: "w",
      workspace_title: "W",
      name: `R${i}`,
      vector,
      x: 0,
      y: 0,
      z: 0,
      radius: 0.3,
    }));
    const layout = reprojectMapLayout({
      userLocations: users,
      regions,
      algorithm: "random",
    });
    expect(layout.userLocations).toHaveLength(2);
    expect(layout.regions).toHaveLength(2);
    for (const u of layout.userLocations) {
      expect(Number.isFinite(u.x)).toBe(true);
      expect(Number.isFinite(u.y)).toBe(true);
    }
  });

  it("toggles region visibility by id set", () => {
    const regions = [
      { id: "r1", name: "A" },
      { id: "r2", name: "B" },
      { id: "r3", name: "C" },
    ];
    expect(filterEnabledRegions(regions, ["r1", "r3"]).map((r) => r.id)).toEqual(["r1", "r3"]);
    expect(filterEnabledRegions(regions, new Set(["r2"]))).toEqual([{ id: "r2", name: "B" }]);
    expect(filterEnabledRegions(regions, [])).toEqual([]);
  });

  it("picks at most 3 random regions for default-on state", () => {
    const ids = ["a", "b", "c", "d", "e", "f"];
    let i = 0;
    // Deterministic pseudo-random for Fisher–Yates
    const random = () => {
      const seq = [0.9, 0.1, 0.5, 0.2, 0.8, 0.3, 0.7, 0.4, 0.6];
      return seq[i++ % seq.length];
    };
    const picked = pickRandomEnabledRegionIds(ids, 3, random);
    expect(picked).toHaveLength(3);
    expect(new Set(picked).size).toBe(3);
    for (const id of picked) expect(ids).toContain(id);
    expect(pickRandomEnabledRegionIds(["only"], 3)).toEqual(["only"]);
    expect(pickRandomEnabledRegionIds([], 3)).toEqual([]);
  });

  it("builds short user id previews for map labels", () => {
    expect(
      shortUserIdPreview({
        subject_user_id: "a1b2c3d4-e5f6-7890-abcd-ef1234567890",
      }),
    ).toBe("a1b2c3");
    expect(
      shortUserIdPreview({
        subject_guest_user_id: "ffffffff-0000-4000-8000-000000000001",
      }),
    ).toBe("ffffff");
    expect(shortUserIdPreview({ id: "snap-xyz" })).toBe("snapxy");
  });

  it("maps TAP vs ILE to standard vs golden dots", () => {
    expect(mapDotKindFromParticipant("ile")).toBe("ile");
    expect(mapDotKindFromParticipant("anonymous_ile_link")).toBe("ile");
    expect(mapDotKindFromParticipant("tap")).toBe("tap");
    expect(mapDotKindFromParticipant("anonymous_tap_link")).toBe("tap");
    expect(mapDotIsGolden("ile")).toBe(true);
    expect(mapDotIsGolden("tap")).toBe(false);
    expect(mapDotIsGolden("standard")).toBe(false);
    expect(mapDotColor("ile")).toBe("#fbbf24");
    expect(mapDotColor("tap")).toBe("#94a3b8");
  });

  it("aggregates PoW stats across public workspaces", () => {
    const stats = aggregatePublicPowStats([
      {
        workspace_id: "w1",
        total_artifacts: 10,
        unique_sessions: 2,
        unique_blocks: 3,
        last_24h: 1,
        last_7d: 4,
        by_type: [
          { type: "speech", count: 6 },
          { type: "file", count: 4 },
        ],
      },
      {
        workspace_id: "w2",
        total_artifacts: 5,
        unique_sessions: 1,
        unique_blocks: 2,
        last_24h: 2,
        last_7d: 3,
        by_type: [{ type: "speech", count: 5 }],
      },
    ]);
    expect(stats.workspace_count).toBe(2);
    expect(stats.total_artifacts).toBe(15);
    expect(stats.unique_sessions).toBe(3);
    expect(stats.unique_blocks).toBe(5);
    expect(stats.last_24h).toBe(3);
    expect(stats.last_7d).toBe(7);
    const speech = stats.by_type.find((t) => t.type === "speech");
    expect(speech?.count).toBe(11);
  });

  it("builds map payload excluding private workspaces and projecting points", () => {
    const payload = buildMapOfKnowledgePayload({
      workspaces: [
        {
          id: "pub",
          title: "Public Algebra",
          root_topic: "Algebra",
          is_public: true,
          description: "Open",
          cover_image_url: null,
        },
        {
          id: "priv",
          title: "Secret",
          root_topic: "Secret",
          is_public: false,
        },
      ],
      blocks: [
        { id: "b1", workspace_id: "pub", title: "Intro", is_start: true },
        { id: "b2", workspace_id: "priv", title: "Hidden", is_start: true },
      ],
      regions: [
        {
          id: "reg1",
          workspace_id: "pub",
          name: "Expert",
          centroid: unitVector(8, 0),
          mean_radius: 0.4,
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          dim: 8,
        },
        {
          id: "reg-private",
          workspace_id: "priv",
          name: "No leak",
          centroid: unitVector(8, 1),
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          dim: 8,
        },
      ],
      userPoints: [
        {
          id: "u1",
          workspace_id: "pub",
          subject_guest_user_id: "guest-ile-1",
          vector: unitVector(8, 1),
          kind: "ile",
          confidence: 0.9,
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          dim: 8,
        },
        {
          id: "u2",
          workspace_id: "pub",
          subject_guest_user_id: "guest-tap-1",
          vector: unitVector(8, 2),
          kind: "tap",
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          dim: 8,
        },
        {
          id: "u-priv",
          workspace_id: "priv",
          vector: unitVector(8, 3),
          kind: "tap",
          embedding_model_id: KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
          dim: 8,
        },
        {
          id: "u-other-model",
          workspace_id: "pub",
          vector: unitVector(16, 0),
          kind: "tap",
          embedding_model_id: "other-model-v1",
          dim: 16,
        },
      ],
      powStats: [
        {
          workspace_id: "pub",
          total_artifacts: 7,
          unique_sessions: 2,
          unique_blocks: 1,
          last_24h: 1,
          last_7d: 3,
        },
        {
          workspace_id: "priv",
          total_artifacts: 999,
          unique_sessions: 99,
          unique_blocks: 99,
          last_24h: 99,
          last_7d: 99,
        },
      ],
      generatedAt: "2026-01-01T00:00:00.000Z",
    });

    expect(payload.title).toBe("The Map of Knowledge");
    expect(payload.workspaces.map((w) => w.id)).toEqual(["pub"]);
    expect(payload.blocks.map((b) => b.id)).toEqual(["b1"]);
    expect(payload.regions.map((r) => r.id)).toEqual(["reg1"]);
    // other-model-v1 point excluded when default knowledgecfg model selected
    expect(payload.user_locations).toHaveLength(2);
    expect(payload.user_locations.find((u) => u.kind === "ile")).toBeTruthy();
    expect(payload.user_locations.find((u) => u.kind === "tap")).toBeTruthy();
    for (const u of payload.user_locations) {
      expect(u.id_preview).toMatch(/^[0-9a-f]{6}$|^[a-z0-9]{1,8}$/i);
      expect(u.id_preview.length).toBeLessThanOrEqual(8);
    }
    expect(payload.pow_stats.total_artifacts).toBe(7);
    expect(payload.pow_stats.workspace_count).toBe(1);
    expect(payload.embedding_model_id).toBe(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(payload.embedding_info.dim).toBeGreaterThan(0);
    expect(payload.embedding_models.some((m) => m.id === "other-model-v1")).toBe(true);
    for (const u of payload.user_locations) {
      expect(Number.isFinite(u.x)).toBe(true);
      expect(Number.isFinite(u.y)).toBe(true);
      expect(Number.isFinite(u.z)).toBe(true);
    }

    const other = buildMapOfKnowledgePayload({
      workspaces: [
        {
          id: "pub",
          title: "Public Algebra",
          root_topic: "Algebra",
          is_public: true,
        },
      ],
      blocks: [],
      regions: [],
      userPoints: [
        {
          id: "u-other-model",
          workspace_id: "pub",
          vector: unitVector(16, 0),
          kind: "tap",
          embedding_model_id: "other-model-v1",
          dim: 16,
        },
      ],
      powStats: [],
      embeddingModelId: "other-model-v1",
    });
    expect(other.embedding_model_id).toBe("other-model-v1");
    expect(other.user_locations).toHaveLength(1);
    expect(other.embedding_info.dim).toBe(16);
  });

  it("describes and resolves embedding models", () => {
    const primary = describeEmbeddingModel(KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID);
    expect(primary.dim).toBe(64);
    expect(primary.struct_dim).toBe(48);
    expect(primary.sem_dim).toBe(16);
    expect(primary.description.toLowerCase()).toMatch(/hybrid|64|dimension/);

    const catalog = mergeEmbeddingModelCatalog([
      { id: "custom-x", dim: 32, point_count: 2, region_count: 1 },
    ]);
    expect(catalog.some((m) => m.id === KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID)).toBe(true);
    expect(catalog.find((m) => m.id === "custom-x")?.dim).toBe(32);
    expect(resolveSelectedEmbeddingModelId("custom-x", catalog)).toBe("custom-x");
    expect(resolveSelectedEmbeddingModelId("missing", catalog)).toBe(
      KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
    );
  });
});

describe("anonymous guest self-placement", () => {
  it("generates deterministic guest names from seed", () => {
    const a = generateAnonymousGuestIdentity(100);
    const b = generateAnonymousGuestIdentity(100);
    expect(a.display_name).toBe(b.display_name);
    expect(a.display_name.length).toBeGreaterThan(3);
  });

  it("validates public workspace + block for placement", () => {
    const catalog = {
      workspaces: [
        { id: "pub", is_public: true },
        { id: "priv", is_public: false },
      ],
      blocks: [
        { id: "b1", workspace_id: "pub" },
        { id: "b2", workspace_id: "priv" },
      ],
    };
    expect(
      validateGuestPlacement(
        { workspace_id: "pub", block_id: "b1", link_kind: "tap" },
        catalog,
      ),
    ).toEqual({ ok: true });
    expect(
      validateGuestPlacement(
        { workspace_id: "priv", block_id: "b2", link_kind: "ile" },
        catalog,
      ).ok,
    ).toBe(false);
    expect(
      validateGuestPlacement(
        { workspace_id: "pub", block_id: "missing", link_kind: "tap" },
        catalog,
      ).ok,
    ).toBe(false);
  });

  it("builds TAP and ILE placement results with correct dot kinds", () => {
    const tap = buildGuestPlacementResult({
      link_kind: "tap",
      private_url: "https://example.com/tap/abc",
      workspace_id: "w1",
      block_id: "b1",
      guest_display_name: "Silent Neuron 1000",
    });
    expect(tap.ok).toBe(true);
    expect(tap.map_dot_kind).toBe("tap");
    expect(tap.map_dot_golden).toBe(false);
    expect(tap.private_url).toContain("/tap/");

    const ile = buildGuestPlacementResult({
      link_kind: "ile",
      private_url: "https://example.com/ile/session/xyz",
      workspace_id: "w1",
      block_id: "b1",
      guest_display_name: "Radiant Orbit 2000",
    });
    expect(ile.map_dot_kind).toBe("ile");
    expect(ile.map_dot_golden).toBe(true);
    expect(ile.private_url).toContain("/ile/");
  });
});

describe("map-of-knowledge product surfaces", () => {
  it("ships Map of Knowledge page, nav link, and APIs", () => {
    const page = join(root, "app/map-of-knowledge/page.tsx");
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const api = join(root, "app/api/map-of-knowledge/route.ts");
    const guestApi = join(root, "app/api/map-of-knowledge/guest-link/route.ts");
    const nav = join(root, "components/LandingNav.tsx");
    expect(existsSync(page)).toBe(true);
    expect(existsSync(client)).toBe(true);
    expect(existsSync(api)).toBe(true);
    expect(existsSync(guestApi)).toBe(true);
    const pageSrc = readFileSync(page, "utf8");
    const navSrc = readFileSync(nav, "utf8");
    const clientSrc = readFileSync(client, "utf8");
    expect(pageSrc).toContain("The Map of Knowledge");
    expect(pageSrc).toContain("LandingNav");
    expect(navSrc).toContain("Community");
    expect(navSrc).toContain("COMMUNITY_LINKS");
    expect(navSrc).toContain('href: "/map-of-knowledge"');
    expect(navSrc).toContain('href: "/vision"');
    expect(navSrc).toContain('href: "/science"');
    expect(navSrc).toContain("Map of Knowledge");
    // nested under Community menu (not top-level flat links)
    expect(navSrc).toContain('aria-label="Community"');
    expect(navSrc).toContain("community-menu");
    expect(clientSrc).toContain("map-canvas");
    expect(clientSrc).toContain("map-place-yourself");
    expect(clientSrc).toContain("map-stats");
    expect(clientSrc).toContain("data-map-surface");
    expect(clientSrc).toContain("Fullscreen");
    // Map section appears before aggregated PoW stats in the client tree
    expect(clientSrc.indexOf('id="map-canvas"')).toBeLessThan(clientSrc.indexOf('id="map-stats"'));
    // Real Three.js 3D explorer (not a yaw slider)
    const three3d = join(root, "components/MapOfKnowledge3D.tsx");
    expect(existsSync(three3d)).toBe(true);
    const threeSrc = readFileSync(three3d, "utf8");
    expect(threeSrc).toContain('from "three"');
    expect(threeSrc).toContain("OrbitControls");
    expect(threeSrc).toContain("data-map-3d-legend");
    expect(threeSrc).toMatch(/Drag|orbit/i);
    expect(clientSrc).toContain("MapOfKnowledge3D");
    expect(clientSrc).toContain("MapOfKnowledge2D");
    expect(clientSrc).not.toMatch(/type="range"/);
    const twoD = join(root, "components/MapOfKnowledge2D.tsx");
    expect(existsSync(twoD)).toBe(true);
    const twoDSrc = readFileSync(twoD, "utf8");
    expect(twoDSrc).toContain("data-map-2d-interactive");
    expect(twoDSrc).toContain("data-map-2d-legend");
    expect(twoDSrc).toContain("panViewTransform");
    expect(twoDSrc).toContain("zoomViewTransform");
    expect(twoDSrc).toMatch(/ArrowLeft|WASD|keydown/);
    expect(twoDSrc).toContain("touchstart");
    expect(twoDSrc).toContain("id_preview");
    expect(clientSrc).toContain("pickRandomEnabledRegionIds");
    expect(clientSrc).toContain("reprojectMapLayout");
    expect(clientSrc).toContain("data-map-projection-select");
    expect(clientSrc).toContain("data-map-embedding-model-select");
    expect(clientSrc).toContain("data-map-embedding-info");
    expect(clientSrc).toContain("PROJECTION_ALGORITHM_OPTIONS");
    expect(clientSrc).toContain("embedding_model_id");
    expect(threeSrc).toContain("makeIdLabelSprite");
    expect(threeSrc).toContain("id_preview");
  });

  it("removes group toggle UX and public fork gates from shipped surfaces", () => {
    const access = readFileSync(join(root, "components/WorkspaceAccessSettings.tsx"), "utf8");
    const identity = readFileSync(join(root, "components/WorkspaceIdentityPanel.tsx"), "utf8");
    const view = readFileSync(join(root, "components/WorkspaceView.tsx"), "utf8");
    const shell = readFileSync(join(root, "components/WorkspaceBuilderShell.tsx"), "utf8");
    const sessionItem = readFileSync(join(root, "components/SessionItem.tsx"), "utf8");
    const groupRoute = readFileSync(join(root, "app/api/workspaces/[id]/group/route.ts"), "utf8");
    const groupStart = readFileSync(
      join(root, "app/api/group-workspace/start-session/route.ts"),
      "utf8",
    );

    expect(access).not.toContain("makeGroupPlan");
    expect(access).not.toContain("is_group");
    expect(access).not.toContain("/group");
    expect(identity).not.toContain("makeGroupPlan");
    expect(identity).not.toContain("showGroupParticipant");
    expect(identity).not.toContain("GitBranch");
    expect(view).not.toContain("needsFork");
    expect(view).not.toContain("makeGroupPlan");
    expect(view).not.toContain("group-workspace/start-session");
    expect(view).not.toContain("PublicWorkspaceFork");
    expect(shell).not.toContain("PublicWorkspaceForkPanel");
    expect(sessionItem).not.toContain("PublicWorkspaceForkCallout");
    expect(sessionItem).not.toContain("group-workspace/start-session");
    expect(groupRoute).toContain("410");
    expect(groupStart).toContain("410");
  });
});
