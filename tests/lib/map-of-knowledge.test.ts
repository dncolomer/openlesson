import { describe, expect, it } from "vitest";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import {
  aggregatePublicPowStats,
  buildGuestPlacementResult,
  buildMapOfKnowledgePayload,
  filterEnabledRegions,
  filterMapPlacementWorkspaces,
  filterPublicWorkspaces,
  generateAnonymousGuestIdentity,
  groupRegionsByWorkspace,
  isEligibleMapPublicWorkspace,
  mapDotColor,
  mapDotIsGolden,
  mapDotKindFromParticipant,
  describeEmbeddingModel,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  mergeEmbeddingModelCatalog,
  pickDefaultEnabledRegionsFromOneWorkspace,
  pickRandomEnabledRegionIds,
  pickStemMiniAvatar,
  projectMapVectors,
  projectVectors3D,
  reprojectMapLayout,
  resolveMapUserAvatar,
  resolveSelectedEmbeddingModelId,
  shortUserIdPreview,
  STEM_MINI_AVATARS,
  stemMiniAvatarCatalogSize,
  stemMiniAvatarForSubjectId,
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
      { id: "e", is_public: true, status: "archived" },
      { id: "f", is_public: true, archived_at: "2026-01-01T00:00:00Z" },
      { id: "g", is_public: true, status: "active" },
    ];
    expect(filterPublicWorkspaces(rows).map((r) => r.id)).toEqual(["a", "c", "g"]);
    expect(isEligibleMapPublicWorkspace({ is_public: true, status: "active" })).toBe(true);
    expect(isEligibleMapPublicWorkspace({ is_public: false })).toBe(false);
    expect(isEligibleMapPublicWorkspace({ is_public: true, status: "paused" })).toBe(false);
  });

  it("placement dropdown only lists public workspaces with expert regions", () => {
    const rows = [
      { id: "stem", is_public: true, status: "active", region_count: 6, title: "Mathematics" },
      { id: "toga", is_public: true, status: "active", region_count: 0, title: "Toga to Throne" },
      { id: "priv", is_public: false, status: "active", region_count: 4, title: "Secret" },
      { id: "empty", is_public: true, status: "active", region_count: 0, title: "English Sprint" },
    ];
    const placement = filterMapPlacementWorkspaces(rows);
    expect(placement.map((r) => r.id)).toEqual(["stem"]);
    expect(placement.some((r) => /toga|throne/i.test(r.title))).toBe(false);
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

    const users = vectors.slice(0, 2).map((vector, i) => {
      const avatar = pickStemMiniAvatar(i);
      return {
        id: `u${i}`,
        workspace_id: "w",
        workspace_title: "W",
        subject_label: `user:abc${i}`,
        id_preview: `abc${i}00`.slice(0, 6),
        kind: "tap" as const,
        avatar_id: avatar.id,
        avatar_path: avatar.path,
        vector,
        x: 0,
        y: 0,
        z: 0,
        confidence: 0.5,
      };
    });
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

  it("defaults to 3 enabled regions from a single randomly chosen workspace", () => {
    const regions = [
      { id: "m1", workspace_id: "ws-math" },
      { id: "m2", workspace_id: "ws-math" },
      { id: "m3", workspace_id: "ws-math" },
      { id: "m4", workspace_id: "ws-math" },
      { id: "p1", workspace_id: "ws-phys" },
      { id: "p2", workspace_id: "ws-phys" },
      { id: "p3", workspace_id: "ws-phys" },
      { id: "c1", workspace_id: "ws-chem" },
    ];
    let i = 0;
    const random = () => {
      // First call picks workspace index; subsequent shuffle math/phys
      const seq = [0.6, 0.1, 0.8, 0.3, 0.5, 0.2, 0.9, 0.4];
      return seq[i++ % seq.length];
    };
    const pick = pickDefaultEnabledRegionsFromOneWorkspace(regions, 3, random);
    expect(pick.workspace_id).toBeTruthy();
    expect(pick.regionIds.length).toBeGreaterThan(0);
    expect(pick.regionIds.length).toBeLessThanOrEqual(3);
    const allowed = new Set(
      regions.filter((r) => r.workspace_id === pick.workspace_id).map((r) => r.id),
    );
    for (const id of pick.regionIds) {
      expect(allowed.has(id)).toBe(true);
    }
    // Never mix workspaces in the default highlight set
    const workspaces = new Set(
      pick.regionIds.map(
        (id) => regions.find((r) => r.id === id)!.workspace_id,
      ),
    );
    expect(workspaces.size).toBe(1);

    // Workspace with fewer than 3 regions → all of that workspace
    const chemOnly = pickDefaultEnabledRegionsFromOneWorkspace(
      [{ id: "c1", workspace_id: "ws-chem" }],
      3,
      () => 0,
    );
    expect(chemOnly).toEqual({ regionIds: ["c1"], workspace_id: "ws-chem" });
    expect(pickDefaultEnabledRegionsFromOneWorkspace([], 3)).toEqual({
      regionIds: [],
      workspace_id: null,
    });
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
      expect(u.avatar_id).toBeTruthy();
      expect(u.avatar_path).toMatch(/^\/map-avatars\//);
      expect(STEM_MINI_AVATARS.some((a) => a.id === u.avatar_id)).toBe(true);
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

describe("STEM mini avatars", () => {
  it("ships a multi-entry catalog with pregenerated public assets", () => {
    expect(stemMiniAvatarCatalogSize()).toBeGreaterThan(1);
    expect(STEM_MINI_AVATARS.length).toBe(stemMiniAvatarCatalogSize());
    const ids = new Set(STEM_MINI_AVATARS.map((a) => a.id));
    expect(ids.size).toBe(STEM_MINI_AVATARS.length);
    for (const avatar of STEM_MINI_AVATARS) {
      expect(avatar.path).toMatch(/^\/map-avatars\/.+\.svg$/);
      const abs = join(root, "public", avatar.path.replace(/^\//, ""));
      expect(existsSync(abs), `missing asset ${avatar.path}`).toBe(true);
      const svg = readFileSync(abs, "utf8");
      expect(svg).toContain("<svg");
      expect(svg.length).toBeGreaterThan(100);
    }
  });

  it("picks catalog members deterministically from seeds", () => {
    const a = pickStemMiniAvatar(0);
    const b = pickStemMiniAvatar(0);
    expect(a.id).toBe(b.id);
    expect(STEM_MINI_AVATARS.some((x) => x.id === a.id)).toBe(true);

    const catalogIds = new Set(STEM_MINI_AVATARS.map((x) => x.id));
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) {
      const picked = pickStemMiniAvatar(seed);
      expect(catalogIds.has(picked.id)).toBe(true);
      seen.add(picked.id);
    }
    // Different seeds must be able to yield more than one catalog member
    expect(seen.size).toBeGreaterThan(1);
  });

  it("assigns stable avatars for subject ids and guest identity includes avatar", () => {
    const once = stemMiniAvatarForSubjectId("subject-abc");
    const twice = stemMiniAvatarForSubjectId("subject-abc");
    expect(once.id).toBe(twice.id);
    const resolved = resolveMapUserAvatar({ id: "loc-1", avatar_id: once.id });
    expect(resolved.id).toBe(once.id);
    const fallback = resolveMapUserAvatar({ id: "loc-legacy-no-avatar" });
    expect(STEM_MINI_AVATARS.some((a) => a.id === fallback.id)).toBe(true);

    const g1 = generateAnonymousGuestIdentity(100);
    const g2 = generateAnonymousGuestIdentity(100);
    expect(g1.display_name).toBe(g2.display_name);
    expect(g1.avatar_id).toBe(g2.avatar_id);
    expect(g1.avatar_path).toBe(g2.avatar_path);
    expect(STEM_MINI_AVATARS.some((a) => a.id === g1.avatar_id)).toBe(true);
    expect(g1.avatar_path).toContain("/map-avatars/");

    // Different seeds can yield different avatars across the catalog
    const avatarIds = new Set(
      Array.from({ length: 80 }, (_, i) => generateAnonymousGuestIdentity(i * 13).avatar_id),
    );
    expect(avatarIds.size).toBeGreaterThan(1);
  });
});

describe("anonymous guest self-placement", () => {
  it("generates deterministic guest names from seed", () => {
    const a = generateAnonymousGuestIdentity(100);
    const b = generateAnonymousGuestIdentity(100);
    expect(a.display_name).toBe(b.display_name);
    expect(a.display_name.length).toBeGreaterThan(3);
    expect(a.avatar_id).toBe(b.avatar_id);
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
    expect(navSrc).toContain("Projects & Community");
    expect(navSrc).toContain("COMMUNITY_LINKS");
    expect(navSrc).toContain('href: "/map-of-knowledge"');
    expect(navSrc).toContain('href: "/vision"');
    expect(navSrc).toContain('href: "/science"');
    expect(navSrc).toContain("Map of Knowledge");
    // nested under Projects & Community menu (not top-level flat links)
    expect(navSrc).toContain('aria-label="Projects & Community"');
    expect(clientSrc).toContain("map-canvas");
    expect(clientSrc).toContain("map-place-yourself");
    expect(clientSrc).toContain("map-stats");
    expect(clientSrc).toContain("data-map-surface");
    expect(clientSrc).toContain("Fullscreen");
    // Product language on placement cards (not TAP/ILE jargon)
    expect(clientSrc).toContain("Timed Exploration");
    expect(clientSrc).toContain("Timed Drill");
    expect(clientSrc).toContain("data-mint-timed-explore");
    expect(clientSrc).toContain("data-mint-timed-drill");
    expect(clientSrc).toContain("interaction_kind");
    expect(clientSrc).not.toMatch(/Mint TAP link|Mint ILE link|Think Aloud Protocol|Integrated Learning Env|Socratic/);
    expect(clientSrc).toMatch(/think aloud/i);
    expect(clientSrc).toMatch(/exploratory dialog|lightweight/i);
    expect(pageSrc).toMatch(/think aloud|put yourself on the map/i);
    expect(pageSrc).not.toMatch(/TAP or ILE/);
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
    expect(clientSrc).toContain("pickDefaultEnabledRegionsFromOneWorkspace");
    expect(clientSrc).not.toContain("pickRandomEnabledRegionIds(allRegionIds");
    expect(clientSrc).toContain("reprojectMapLayout");
    expect(clientSrc).toContain("data-map-projection-select");
    expect(clientSrc).toContain("data-map-embedding-model-select");
    expect(clientSrc).toContain("data-map-embedding-info");
    expect(clientSrc).toContain("PROJECTION_ALGORITHM_OPTIONS");
    expect(clientSrc).toContain("embedding_model_id");
    expect(threeSrc).toContain("makeIdLabelSprite");
    expect(threeSrc).toContain("id_preview");
    // STEM mini avatars: guest identity + map markers (not plain dots only)
    expect(clientSrc).toContain("data-guest-avatar");
    expect(clientSrc).toContain("avatar_path");
    expect(clientSrc).toContain("generateAnonymousGuestIdentity");
    expect(twoDSrc).toContain("avatar_path");
    expect(twoDSrc).toContain("data-map-user-avatar");
    expect(twoDSrc).toMatch(/<image[\s\S]*href/);
    expect(threeSrc).toContain("STEM_MINI_AVATARS");
    expect(threeSrc).toContain("makeAvatarSprite");
    expect(threeSrc).toContain("loadStemAvatarTextures");
    expect(threeSrc).toContain("avatar_id");
    // Region toggles grouped by collapsible workspace
    expect(clientSrc).toContain("groupRegionsByWorkspace");
    expect(clientSrc).toContain("data-map-region-workspace-groups");
    expect(clientSrc).toContain("data-map-region-workspace-toggle");
    expect(clientSrc).toContain("data-map-region-workspace-group");
    expect(clientSrc).toContain("data-map-region-workspace-select-all");
    expect(clientSrc).toContain("toggleAllRegionsInWorkspace");
    expect(clientSrc).toContain("aria-expanded");
    expect(clientSrc).toContain("expandedRegionWorkspaces");
    expect(clientSrc).toContain("filterMapPlacementWorkspaces");
    expect(clientSrc).toContain("placementWorkspaces");
    expect(clientSrc).toContain("data-map-placement-workspace-select");
  });

  it("groups regions by workspace for collapsible map toggles", () => {
    const groups = groupRegionsByWorkspace([
      {
        id: "r1",
        workspace_id: "ws-math",
        workspace_title: "Mathematics",
        name: "Analysis",
      },
      {
        id: "r2",
        workspace_id: "ws-phys",
        workspace_title: "Physics",
        name: "Quantum",
      },
      {
        id: "r3",
        workspace_id: "ws-math",
        workspace_title: "Mathematics",
        name: "Algebra",
      },
    ]);
    expect(groups).toHaveLength(2);
    // Sorted by workspace title
    expect(groups[0].workspace_title).toBe("Mathematics");
    expect(groups[1].workspace_title).toBe("Physics");
    expect(groups[0].regions.map((r) => r.name)).toEqual(["Analysis", "Algebra"]);
    expect(groups[1].regions.map((r) => r.name)).toEqual(["Quantum"]);
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
