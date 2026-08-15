import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { ayclTokenFromBody, guardWorkspaceRoute } from "@/lib/api/require-auth";
import {
  callXaiJSON,
  systemMessage,
  userMessage,
  DEFAULT_MODEL,
} from "@/lib/xai-client";
import {
  applyAiTextToAreaSummary,
  buildAreaSummarySystemMessage,
  buildAreaSummaryUserPrompt,
  buildMapOverviewSystemMessage,
  buildMapOverviewUserPrompt,
  buildMapOverviewSummary,
  buildMapSearchSystemMessage,
  buildMapSearchUserPrompt,
  buildSuggestSpotSystemMessage,
  buildSuggestSpotUserPrompt,
  emptyMapBlocksToMinimapPlacements,
  parseAreaSummaryAiResponse,
  parseMapSearchAiResponse,
  parseOverviewAiResponse,
  parseSuggestSpotAiResponse,
  resolveSuggestSpotLimit,
  suggestEmptySpotsForTopic,
  summarizeSelectiveArea,
  type EmptyMapBlock,
  type EmptyMapCell,
  type MapExploreOp,
} from "@/lib/empty-map-pane";
import { buildMinimapClusterGraph } from "@/lib/map-minimap-clusters";
import {
  buildOccupancyFromPlaced,
  type PlacedBlockRef,
} from "@/lib/skill-grid-ops";

type Body = {
  workspaceId?: string;
  op?: MapExploreOp | string;
  query?: string;
  topic?: string;
  userHint?: string;
  blocks?: EmptyMapBlock[];
  unusableCells?: Array<{ row: number; col: number }>;
  polygon?: Array<{ x: number; y: number }>;
  model?: string;
  locale?: string;
  limit?: number;
  ayclToken?: string;
};

function asBlocks(raw: unknown): EmptyMapBlock[] {
  if (!Array.isArray(raw)) return [];
  const out: EmptyMapBlock[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const rec = item as Record<string, unknown>;
    const id = String(rec.id ?? "").trim();
    if (!id) continue;
    out.push({
      id,
      title: rec.title != null ? String(rec.title) : null,
      description: rec.description != null ? String(rec.description) : null,
      position_x:
        rec.position_x != null && Number.isFinite(Number(rec.position_x))
          ? Number(rec.position_x)
          : null,
      position_y:
        rec.position_y != null && Number.isFinite(Number(rec.position_y))
          ? Number(rec.position_y)
          : null,
      span_w:
        rec.span_w != null && Number.isFinite(Number(rec.span_w))
          ? Number(rec.span_w)
          : 1,
      span_h:
        rec.span_h != null && Number.isFinite(Number(rec.span_h))
          ? Number(rec.span_h)
          : 1,
      shape_cells: Array.isArray(rec.shape_cells)
        ? (rec.shape_cells as EmptyMapBlock["shape_cells"])
        : null,
    });
  }
  return out;
}

function occupancyFromBlocks(blocks: EmptyMapBlock[]): Set<string> {
  const placed: PlacedBlockRef[] = [];
  for (const b of blocks) {
    const px = Number(b.position_x);
    const py = Number(b.position_y);
    if (!Number.isFinite(px) || !Number.isFinite(py)) continue;
    placed.push({
      id: b.id,
      position_x: Math.trunc(px),
      position_y: Math.trunc(py),
      span_w: Math.max(1, Math.trunc(Number(b.span_w) || 1)),
      span_h: Math.max(1, Math.trunc(Number(b.span_h) || 1)),
      shape_cells: b.shape_cells ?? null,
    });
  }
  if (!placed.length) return new Set();
  return new Set(buildOccupancyFromPlaced(placed).keys());
}

/**
 * xAI-powered map exploration for the empty-selection right pane.
 * ops: search | suggest_spot | overview | area_summary
 */
export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;
    const workspaceId =
      typeof body.workspaceId === "string" ? body.workspaceId.trim() : "";
    if (!workspaceId) {
      return jsonError(400, "workspaceId is required");
    }

    const auth = await guardWorkspaceRoute(workspaceId, {
      ayclToken: ayclTokenFromBody(body as Record<string, unknown>),
      // Available in Build + Play (including AYCL learner tier).
      requireAyclAuthoring: false,
    });
    if (!auth.ok) return auth.response;

    const op = String(body.op || "").trim() as MapExploreOp;
    if (
      op !== "search" &&
      op !== "suggest_spot" &&
      op !== "overview" &&
      op !== "area_summary"
    ) {
      return jsonError(400, "op must be one of: search, suggest_spot, overview, area_summary",);
    }

    const blocks = asBlocks(body.blocks);
    const unusableKeys = (body.unusableCells || [])
      .filter((c) => c && Number.isFinite(c.row) && Number.isFinite(c.col))
      .map((c) => `${Math.trunc(c.row)}:${Math.trunc(c.col)}`);
    const languageNote =
      body.locale && body.locale !== "en"
        ? `Respond in ${body.locale}.`
        : "";
    const model = body.model || DEFAULT_MODEL;

    if (op === "search") {
      const query = String(body.query ?? "").trim();
      if (!query) {
        return NextResponse.json({
          op,
          blockIds: [],
          rationale: "",
          source: "empty_query",
        });
      }
      const ai = await callXaiJSON<{
        blockIds?: unknown;
        rationale?: unknown;
      }>(
        [
          systemMessage(
            buildMapSearchSystemMessage() +
              (languageNote ? `\n${languageNote}` : ""),
          ),
          userMessage(buildMapSearchUserPrompt({ query, blocks })),
        ],
        { model, maxTokens: 900, temperature: 0.4 },
      );
      const valid = new Set(blocks.map((b) => b.id));
      const parsed = parseMapSearchAiResponse(
        ai.success ? ai.data : null,
        valid,
      );
      return NextResponse.json({
        op,
        blockIds: parsed.blockIds,
        rationale: parsed.rationale,
        source: ai.success ? "xai" : "fallback_empty",
      });
    }

    if (op === "suggest_spot") {
      const topic = String(body.topic ?? body.query ?? "").trim();
      const limit = resolveSuggestSpotLimit(body.limit);
      const occupied = occupancyFromBlocks(blocks);
      const ai = await callXaiJSON<{
        cells?: unknown;
        rationale?: unknown;
      }>(
        [
          systemMessage(
            buildSuggestSpotSystemMessage() +
              (languageNote ? `\n${languageNote}` : ""),
          ),
          userMessage(
            buildSuggestSpotUserPrompt({
              topic,
              blocks,
              unusableKeys,
              limit,
            }),
          ),
        ],
        { model, maxTokens: 900, temperature: 0.45 },
      );
      let parsed = parseSuggestSpotAiResponse(ai.success ? ai.data : null, {
        occupiedKeys: occupied,
        unusableKeys,
        limit,
      });
      // If model returned nothing usable, fall back to geometric neighbor heuristic.
      if (parsed.cells.length === 0) {
        const fallback = suggestEmptySpotsForTopic({
          blocks,
          topic,
          occupiedKeys: occupied,
          unusableKeys,
          limit,
        });
        parsed = {
          cells: fallback,
          rationale: parsed.rationale || "Nearby empty cells near related content.",
        };
      }
      return NextResponse.json({
        op,
        cells: parsed.cells as EmptyMapCell[],
        rationale: parsed.rationale,
        source: ai.success && parsed.cells.length ? "xai" : "fallback_geometry",
      });
    }

    if (op === "overview") {
      const placements = emptyMapBlocksToMinimapPlacements(blocks);
      const graph = buildMinimapClusterGraph(placements);
      const heuristic = buildMapOverviewSummary(blocks);
      if (blocks.length === 0) {
        return NextResponse.json({
          op,
          summary: heuristic.text,
          blockCount: 0,
          clusterCount: 0,
          source: "empty_map",
        });
      }
      const clusterHints = graph.clusters
        .map(
          (c, i) =>
            `cluster ${i + 1}: ${c.count} blocks near (${c.center.row},${c.center.col})`,
        )
        .join("; ");
      const ai = await callXaiJSON<{ summary?: unknown }>(
        [
          systemMessage(
            buildMapOverviewSystemMessage() +
              (languageNote ? `\n${languageNote}` : ""),
          ),
          userMessage(
            buildMapOverviewUserPrompt({
              blocks,
              clusterHints,
            }),
          ),
        ],
        { model, maxTokens: 700, temperature: 0.55 },
      );
      const summary =
        parseOverviewAiResponse(ai.success ? ai.data : null) || heuristic.text;
      return NextResponse.json({
        op,
        summary,
        blockCount: heuristic.blockCount,
        clusterCount: heuristic.clusterCount,
        source: ai.success && parseOverviewAiResponse(ai.data) ? "xai" : "fallback",
      });
    }

    // area_summary
    const polygon = Array.isArray(body.polygon)
      ? body.polygon
          .filter(
            (p) =>
              p &&
              Number.isFinite(Number(p.x)) &&
              Number.isFinite(Number(p.y)),
          )
          .map((p) => ({ x: Number(p.x), y: Number(p.y) }))
      : [];
    const base = summarizeSelectiveArea({
      polygon,
      blocks,
      unusableKeys,
    });
    const blocksInArea = blocks.filter((b) => base.blockIds.includes(b.id));
    const ai = await callXaiJSON<{ summary?: unknown }>(
      [
        systemMessage(
          buildAreaSummarySystemMessage() +
            (languageNote ? `\n${languageNote}` : ""),
        ),
        userMessage(
          buildAreaSummaryUserPrompt({
            blocksInArea,
            emptyCellCount: base.emptyCells.length,
            centroid: base.centroid,
            userHint: body.userHint,
          }),
        ),
      ],
      { model, maxTokens: 700, temperature: 0.55 },
    );
    const aiText = parseAreaSummaryAiResponse(ai.success ? ai.data : null);
    const summary = applyAiTextToAreaSummary(base, aiText || base.text);
    return NextResponse.json({
      op,
      summary: summary.text,
      blockIds: summary.blockIds,
      emptyCells: summary.emptyCells,
      centroid: summary.centroid,
      source: aiText ? "xai" : "fallback_geometry",
    });
  } catch (err) {
    console.error("[map-explore]", err);
    return jsonError(
      500,
      err instanceof Error ? err.message : "Failed to explore map with xAI",
    );
  }
}
