import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { readMapGridSurface } from "../helpers/surface-source";
import {
  BLOCK_MAP_PATTERN_MAX,
  blockMapGlyphDbFields,
  blockMapPatternBits,
  blockMapPatternCells,
  composeBlockMapGlyphJsonInstruction,
  DEFAULT_BLOCK_MAP_ICON,
  encodeBlockMapPattern,
  isBlockMapIconName,
  normalizeBlockMapIcon,
  normalizeBlockMapKeyword,
  parseBlockMapIconName,
  pickRandomBlockMapIcon,
  resolveBlockMapGlyph,
} from "@/lib/block-map-glyph";
import { resolveMapOccupiedTileBadges } from "@/lib/map-tile-badges";
import { composeGenerateShapeBlockSystemMessage } from "@/lib/block-footprint-prompt";
import { composeAddBlockAtSlotSystemMessage } from "@/lib/workspace-authoring-prompt-context";
import { composeEffectGenerationSystemMessage } from "@/lib/block-effect-generation";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("block map glyph (keyword + random 3×3 squares)", () => {
  it("encodes non-empty 3×3 occupancy masks", () => {
    expect(DEFAULT_BLOCK_MAP_ICON).toBe("g27");
    expect(encodeBlockMapPattern(0)).toBeNull();
    expect(encodeBlockMapPattern(512)).toBeNull();
    expect(encodeBlockMapPattern(1)).toBe("g1");
    expect(encodeBlockMapPattern(BLOCK_MAP_PATTERN_MAX)).toBe("g511");
    expect(blockMapPatternBits("g27")).toBe(27);
    expect(blockMapPatternCells("g27")).toEqual([
      true,
      true,
      false,
      true,
      true,
      false,
      false,
      false,
      false,
    ]);
    expect(parseBlockMapIconName("g186")).toBe("g186");
    expect(parseBlockMapIconName("Square")).toBeNull();
    expect(parseBlockMapIconName("Cube")).toBeNull();
    expect(parseBlockMapIconName("g0")).toBeNull();
  });

  it("renders a 3×3 of solid squares (no lucide, no rounded rx)", () => {
    const icons = read("components/block-skill-grid/map-block-glyph-icon.tsx");
    expect(icons).toContain('data-block-map-grid="3x3"');
    expect(icons).toContain('data-block-map-variant={variant}');
    expect(icons).toContain('fill={outline ? "none" : "currentColor"}');
    expect(icons).toContain('stroke={outline ? "currentColor" : "none"}');
    expect(icons).toContain("blockMapPatternCells");
    expect(icons).not.toMatch(/\brx=/);
    expect(icons).not.toContain("lucide-react");
    expect(icons).not.toContain("Cube");
  });

  it("normalizes two keywords; hashes unknown icons into a 3×3 pattern", () => {
    expect(normalizeBlockMapKeyword("  linear-algebra extra ", "Fallback")).toBe(
      "Linear-algebra Extra",
    );
    expect(normalizeBlockMapKeyword("", "Fourier Transforms")).toBe(
      "Fourier Transforms",
    );
    expect(normalizeBlockMapKeyword("Optics", "Geometric optics")).toBe(
      "Geometric Optics",
    );
    expect(normalizeBlockMapKeyword("Lemmas", "Proofs")).toBe("Lemmas Proofs");
    expect(normalizeBlockMapKeyword(null, "")).toBe("Topic");
    expect(normalizeBlockMapIcon("g27", "X")).toBe("g27");
    expect(isBlockMapIconName(normalizeBlockMapIcon("flask-conical", "Optics"))).toBe(
      true,
    );
  });

  it("create-time fields pick a random 3×3 pattern, not the LLM icon", () => {
    const glyph = blockMapGlyphDbFields(
      { title: "Proofs", keyword: "lemmas", icon: "Sigma" },
      "Proofs",
      () => 0,
    );
    expect(glyph.map_keyword).toBe("Lemmas Proofs");
    expect(glyph.map_icon).toBe("g1");
    const other = blockMapGlyphDbFields({}, "Binary Search Trees", () => 0.99);
    expect(other.map_keyword).toBe("Binary Search");
    expect(other.map_icon).toBe(
      `g${1 + Math.floor(0.99 * BLOCK_MAP_PATTERN_MAX)}`,
    );
    expect(pickRandomBlockMapIcon(() => 0)).toBe("g1");
  });

  it("resolves stored 3×3 patterns; hashes unknown names", () => {
    expect(
      resolveBlockMapGlyph({
        map_keyword: "Wave Optics",
        map_icon: "g27",
        title: "Geometric optics",
      }),
    ).toEqual({ keyword: "Wave Optics", icon: "g27" });
    const derived = resolveBlockMapGlyph({ title: "Organic chemistry lab" });
    expect(derived.keyword).toBe("Organic Chemistry");
    expect(isBlockMapIconName(derived.icon)).toBe(true);
  });

  it("generation prompts ask for keyword only (pattern is server-assigned)", () => {
    const instruction = composeBlockMapGlyphJsonInstruction();
    expect(instruction).toMatch(/keyword/);
    expect(instruction).toMatch(/exactly two map words/i);
    expect(instruction).not.toMatch(/exactly one map word/i);
    expect(instruction).toMatch(/random 3×3 rearrangement/i);
    expect(composeGenerateShapeBlockSystemMessage()).toContain("keyword");
    expect(composeGenerateShapeBlockSystemMessage()).toMatch(/Do not pick an icon/);
    expect(composeAddBlockAtSlotSystemMessage()).toContain("keyword");
    expect(composeEffectGenerationSystemMessage()).toContain("keyword");
    expect(read("lib/workspace-grid-ops/generate_shape.ts")).toContain(
      "blockMapGlyphDbFields",
    );
    expect(read("app/api/workspace/add-block-at-slot/route.ts")).toContain(
      "map_keyword",
    );
    expect(read("lib/insert-workspace-blocks.ts")).toContain("map_keyword");
  });

  it("workspace tiles show glyph and hide occupancy modifiers", () => {
    const badges = resolveMapOccupiedTileBadges({
      surface: "block",
      hasDagLock: true,
      isStart: true,
      hasPractice: true,
      hasLocalContext: true,
      hasEffects: true,
      generatorBusy: true,
    });
    expect(badges).toEqual({
      showLock: false,
      showStarter: false,
      showPractice: false,
      showLocalContext: false,
      showEffects: false,
      showGeneratorBusy: false,
    });

    const grid = readMapGridSurface();
    expect(grid).toContain('labelMode="glyph"');
    expect(grid).toContain('glyphVariant={isChapterSurface ? "outline" : "solid"}');
    expect(grid).toContain("data-map-cell-status=\"keyword\"");
    expect(grid).toContain("line-clamp-2");
    expect(grid).toContain("BlockMapGlyphIcon");
    expect(grid).toContain("resolveBlockMapGlyph");
    expect(grid).toContain('data-block-map-grid="3x3"');
  });
});
