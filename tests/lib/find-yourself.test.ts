import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "fs";
import { join } from "path";
import {
  buildFindYourselfMapFocus,
  enabledRegionsForFindYourself,
  findMapUserForGuestSubject,
  parsePlacementLinkToken,
  type MapUserLocation,
} from "@/lib/map-of-knowledge";

const root = join(__dirname, "../..");

function user(
  partial: Partial<MapUserLocation> & Pick<MapUserLocation, "id" | "workspace_id">,
): MapUserLocation {
  return {
    workspace_title: "WS",
    subject_label: "guest:abc123",
    id_preview: "abc123",
    kind: "tap",
    avatar_id: "atom",
    avatar_path: "/map-avatars/atom.svg",
    vector: [1, 0, 0],
    x: 0.1,
    y: 0.2,
    z: 0.05,
    confidence: 0.5,
    subject_guest_user_id: null,
    subject_user_id: null,
    ...partial,
  };
}

describe("parsePlacementLinkToken — shipped pure parser", () => {
  it("extracts token from full TAP / ILE session URLs", () => {
    expect(
      parsePlacementLinkToken("https://app.example.com/tap/session/tok_abc-DEF123"),
    ).toBe("tok_abc-DEF123");
    expect(parsePlacementLinkToken("https://app.example.com/ile/session/xyz987654")).toBe(
      "xyz987654",
    );
    expect(parsePlacementLinkToken("/tap/session/relativeToken99")).toBe("relativeToken99");
  });

  it("accepts bare tokens and rejects empty / too short", () => {
    expect(parsePlacementLinkToken("  bareTokenLongEnough  ")).toBe("bareTokenLongEnough");
    expect(parsePlacementLinkToken("")).toBeNull();
    expect(parsePlacementLinkToken("   ")).toBeNull();
    expect(parsePlacementLinkToken("short")).toBeNull();
  });
});

describe("findMapUserForGuestSubject + buildFindYourselfMapFocus", () => {
  const guestId = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const users = [
    user({
      id: "snap-1",
      workspace_id: "ws-math",
      subject_guest_user_id: guestId,
      id_preview: guestId.replace(/-/g, "").slice(0, 6),
      x: 1,
      y: 2,
      z: 0.5,
    }),
    user({
      id: "snap-2",
      workspace_id: "ws-other",
      subject_guest_user_id: "ffffffff-1111-2222-3333-444444444444",
      id_preview: "ffffff",
    }),
  ];
  const regions = [
    { id: "r1", workspace_id: "ws-math" },
    { id: "r2", workspace_id: "ws-math" },
    { id: "r3", workspace_id: "ws-other" },
  ];

  it("matches full guest UUID and workspace", () => {
    const hit = findMapUserForGuestSubject(users, guestId, "ws-math");
    expect(hit?.id).toBe("snap-1");
    expect(findMapUserForGuestSubject(users, guestId, "ws-other")).toBeNull();
  });

  it("enabledRegionsForFindYourself returns all regions in workspace", () => {
    expect(enabledRegionsForFindYourself(regions, "ws-math").sort()).toEqual(["r1", "r2"]);
    expect(enabledRegionsForFindYourself(regions, "")).toEqual([]);
  });

  it("buildFindYourselfMapFocus returns Local Map focus when subject is on the map", () => {
    const ok = buildFindYourselfMapFocus({
      users,
      regions,
      guest_user_id: guestId,
      workspace_id: "ws-math",
    });
    expect(ok.ok).toBe(true);
    if (!ok.ok) return;
    expect(ok.map_scope).toBe("local");
    expect(ok.focused_user_id).toBe("snap-1");
    expect(ok.enabled_region_ids.sort()).toEqual(["r1", "r2"]);
  });

  it("buildFindYourselfMapFocus fails clearly when guest is not on the map", () => {
    const miss = buildFindYourselfMapFocus({
      users,
      regions,
      guest_user_id: "00000000-0000-0000-0000-000000000000",
      workspace_id: "ws-math",
    });
    expect(miss.ok).toBe(false);
    if (miss.ok) return;
    expect(miss.code).toBe("not_on_map");
    expect(miss.error.toLowerCase()).toMatch(/periodic snapshot|newsletter/);
    expect(miss.error).not.toMatch(/Finish the session and wait until your practice is processed/);
    expect(miss.error).not.toMatch(/we will notify you when your map location is ready/i);
  });

  it("invalid empty guest does not invent a focus", () => {
    const empty = buildFindYourselfMapFocus({
      users,
      regions,
      guest_user_id: "",
      workspace_id: "ws-math",
    });
    expect(empty.ok).toBe(false);
  });
});

describe("Find yourself UI surfaces", () => {
  it("MoK client ships save-link reminder + Find yourself control; drops Embedding space panel", () => {
    const client = join(root, "components/MapOfKnowledgeClient.tsx");
    const api = join(root, "app/api/map-of-knowledge/find-yourself/route.ts");
    expect(existsSync(client)).toBe(true);
    expect(existsSync(api)).toBe(true);
    const clientSrc = readFileSync(client, "utf8");
    const apiSrc = readFileSync(api, "utf8");

    expect(clientSrc).toContain("data-minted-save-link-reminder");
    expect(clientSrc).toMatch(/Save this link|save this link|find yourself on the map later/i);
    expect(clientSrc).toContain("data-map-find-yourself");
    expect(clientSrc).toContain("data-map-find-yourself-toggle");
    expect(clientSrc).toContain("Find yourself");
    expect(clientSrc).toContain("data-map-find-yourself-link-input");
    expect(clientSrc).toContain("data-map-find-yourself-submit");
    expect(clientSrc).toContain("buildFindYourselfMapFocus");
    expect(clientSrc).toContain('setMapScope("local")');
    expect(clientSrc).toContain("focusedUserId");
    // Embedding space collapsible removed from that chrome role
    expect(clientSrc).not.toContain("data-map-embedding-info");
    expect(clientSrc).not.toContain("data-map-embedding-info-toggle");

    expect(apiSrc).toContain("parsePlacementLinkToken");
    expect(apiSrc).toContain("workspace_tap_sessions");
    expect(apiSrc).toContain("guest_user_id");
  });
});
