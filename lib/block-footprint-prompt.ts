/**
 * Prompt language for skill-grid footprint size.
 * Cell count relative to a 1×1 single block indicates ILE/TAP topical breadth.
 */

export function blockFootprintCellCount(spanW: number, spanH: number): number {
  const w = Math.max(1, Math.floor(Number(spanW) || 1));
  const h = Math.max(1, Math.floor(Number(spanH) || 1));
  return w * h;
}

/**
 * Explain how large a footprint is vs a single ILE/TAP assessable unit (1×1).
 */
export function describeBlockBreadthRelativeToSingle(spanW: number, spanH: number): string {
  const w = Math.max(1, Math.floor(Number(spanW) || 1));
  const h = Math.max(1, Math.floor(Number(spanH) || 1));
  const cells = w * h;
  if (cells === 1) {
    return [
      `Footprint: 1×1 (1 single-block unit).`,
      `ILE/TAP breadth: baseline — one focused assessable scope (a single coherent demonstration, practice slice, or verification surface).`,
    ].join(" ");
  }
  return [
    `Footprint: ${w}×${h} cells (${cells} single-block units).`,
    `ILE/TAP breadth: ~${cells}× a baseline 1×1 block — proportionally broader competency coverage, deeper/longer proof-of-work, and a wider verification surface than a single-cell topic.`,
  ].join(" ");
}

export function formatSourceBlockSizeLine(block: {
  title: string;
  span_w?: number;
  span_h?: number;
  description?: string | null;
}): string {
  const w = Math.max(1, Math.floor(Number(block.span_w) || 1));
  const h = Math.max(1, Math.floor(Number(block.span_h) || 1));
  const cells = w * h;
  const desc = block.description?.trim() ? ` — ${block.description.trim().slice(0, 160)}` : "";
  return `- "${block.title}" (${w}×${h}, ${cells} single-block unit${cells === 1 ? "" : "s"})${desc}`;
}

const SIZE_ONTOLOGY = `Size ontology (skill grid):
- A 1×1 block is the baseline ILE / TAP unit: narrow, focused, one assessable learning/performance slice.
- Multi-cell blocks (W×H) are broader topics: their cell count ≈ relative breadth vs a single block (e.g. 2×2 ≈ four singles of scope).
- Larger footprints should read as wider conversion/verification surfaces; smaller ones as tighter practice checkpoints.`;

export function composeMergeBlockUserPrompt(input: {
  context: string;
  sourceBlocks: Array<{
    title: string;
    span_w?: number;
    span_h?: number;
    description?: string | null;
  }>;
  resultSpanW: number;
  resultSpanH: number;
  userGuidance: string;
  languageNote?: string;
}): string {
  const resultCells = blockFootprintCellCount(input.resultSpanW, input.resultSpanH);
  const sourceLines = input.sourceBlocks.map(formatSourceBlockSizeLine).join("\n");
  const sourceCellSum = input.sourceBlocks.reduce(
    (sum, b) => sum + blockFootprintCellCount(b.span_w ?? 1, b.span_h ?? 1),
    0,
  );

  const parts = [
    input.context.trim(),
    SIZE_ONTOLOGY,
    `Merge operation: combine contiguous learning blocks into one larger block.`,
    `Source blocks (total footprint ≈ ${sourceCellSum} single-block units):`,
    sourceLines || "(none)",
    `Resulting merged footprint: ${input.resultSpanW}×${input.resultSpanH} (${resultCells} single-block units).`,
    describeBlockBreadthRelativeToSingle(input.resultSpanW, input.resultSpanH),
    `Title/description must match that breadth: broader and more integrative than any single 1×1 source, suitable for a larger ILE/TAP session surface.`,
    `User guidance: ${input.userGuidance.trim() || "Synthesize a broader topic that unifies these blocks."}`,
    `Return one block title and description for the merged topic.`,
  ];
  if (input.languageNote?.trim()) parts.push(input.languageNote.trim());
  return parts.filter(Boolean).join("\n\n");
}

export function composeMergeBlockSystemMessage(): string {
  return [
    "You merge learning blocks into one larger skill-grid topic.",
    "Grid size encodes ILE/TAP breadth: multi-cell results are broader than 1×1 singles.",
    'Return JSON only: { "title": "...", "description": "..." }.',
    "Title: 4-16 words. Description: 2-4 sentences that reflect the broader merged scope.",
  ].join(" ");
}

export function composeGenerateShapeBlockUserPrompt(input: {
  context: string;
  spanW: number;
  spanH: number;
  anchorRow: number;
  anchorCol: number;
  neighborSummary: string;
  userRequest: string;
  languageNote?: string;
  /** Actual occupied cell count (freeform may be less than spanW×spanH). */
  cellCount?: number;
  freeform?: boolean;
}): string {
  const bboxCells = blockFootprintCellCount(input.spanW, input.spanH);
  const cells =
    input.cellCount != null && Number.isFinite(input.cellCount)
      ? Math.max(1, Math.floor(input.cellCount))
      : bboxCells;
  const freeformNote = input.freeform
    ? `Freeform contiguous shape (${cells} cells) inside bounding box ${input.spanW}×${input.spanH} — not necessarily a filled rectangle.`
    : `Solid rectangular region ${input.spanW}×${input.spanH}.`;
  const parts = [
    input.context.trim(),
    SIZE_ONTOLOGY,
    `Generate-in-shape: create exactly one learning block (lecture) for a multi-cell region.`,
    `Target region: anchor (${input.anchorRow},${input.anchorCol}) · ${freeformNote}`,
    describeBlockBreadthRelativeToSingle(
      input.freeform ? Math.max(1, Math.ceil(Math.sqrt(cells))) : input.spanW,
      input.freeform ? Math.max(1, Math.ceil(cells / Math.max(1, Math.ceil(Math.sqrt(cells))))) : input.spanH,
    ),
    cells === 1
      ? `Scope the topic as a baseline single ILE/TAP unit.`
      : `Scope the topic ~${cells}× broader than a single-cell block (${cells} single-block units of lecture breadth): wider competency cluster and richer proof-of-work expectations.`,
    `Nearby blocks:\n${input.neighborSummary.trim() || "none"}`,
    `User request: "${input.userRequest.trim()}"`,
    `Create exactly one learning block that occupies this combined shape as one lecture.`,
  ];
  if (input.languageNote?.trim()) parts.push(input.languageNote.trim());
  return parts.filter(Boolean).join("\n\n");
}

export function composeGenerateShapeBlockSystemMessage(): string {
  return [
    "You create a single learning block for a skill-grid region.",
    "Footprint cell count vs 1×1 encodes ILE/TAP topical breadth — match title and description to that breadth.",
    'Return JSON only: { "title": "...", "description": "..." }.',
    "Title: 4-14 words. Description: 1-3 sentences.",
  ].join(" ");
}

/**
 * Suggest 3 title options for generate-in-shape (must match multi-cell breadth).
 * Pure — tests drive this; the API only fills workspace context.
 */
export function composeSuggestShapeBlockTitlesUserPrompt(input: {
  workspaceTitle: string;
  workspaceDescription?: string | null;
  existingBlocksSummary: string;
  entityLabel: string;
  spanW: number;
  spanH: number;
  anchorRow: number;
  anchorCol: number;
  cellCount?: number;
  neighborSummary: string;
  languageNote?: string;
}): string {
  const cells =
    input.cellCount != null && Number.isFinite(input.cellCount)
      ? Math.max(1, Math.floor(input.cellCount))
      : blockFootprintCellCount(input.spanW, input.spanH);
  const w = Math.max(1, Math.floor(Number(input.spanW) || 1));
  const h = Math.max(1, Math.floor(Number(input.spanH) || 1));
  const desc = input.workspaceDescription?.trim();

  const parts = [
    `Workspace: ${input.workspaceTitle.trim() || "Untitled workspace"}`,
    desc ? `Description: ${desc}` : "",
    `Existing ${input.entityLabel}s:\n${input.existingBlocksSummary.trim() || "(none yet)"}`,
    SIZE_ONTOLOGY,
    `Generate-in-shape suggestion: propose titles for ONE ${input.entityLabel} that will occupy a multi-cell region.`,
    `Target region: anchor (${input.anchorRow},${input.anchorCol}) span ${w}×${h} (${cells} single-block units / selected empty cells ≈ ${cells}).`,
    describeBlockBreadthRelativeToSingle(w, h),
    cells === 1
      ? `Scope as a baseline single ILE/TAP unit (focused title).`
      : `Every option must read ~${cells}× broader than a 1×1 title — a wider competency cluster / richer ILE/TAP surface, not a narrow single-cell drill.`,
    `Nearby ${input.entityLabel}s (distance-weighted — closer items should influence themes more):\n${input.neighborSummary.trim() || "none"}`,
    `Suggest exactly 3 distinct ${input.entityLabel} titles that fit this shape's breadth and complement existing items without duplicating them.`,
    `Keep each suggestion 4-14 words, specific and actionable as a title. Prefer themes whose scope matches the ${w}×${h} footprint.`,
  ];
  if (input.languageNote?.trim()) parts.push(input.languageNote.trim());
  return parts.filter(Boolean).join("\n\n");
}

export function composeSuggestShapeBlockTitlesSystemMessage(entityLabel: string): string {
  return [
    `You suggest ${entityLabel} titles for a multi-cell skill-grid region (generate-in-shape).`,
    "Footprint cell count vs 1×1 encodes ILE/TAP topical breadth — every title must match that breadth.",
    'Return JSON only: { "suggestions": ["...", "...", "..."] } with exactly 3 concise titles.',
  ].join(" ");
}

export interface SplitPartSpec {
  position_x: number;
  position_y: number;
  /** 0-based index within the split (0 = keep original block cell). */
  index: number;
}

export function composeSplitBlockUserPrompt(input: {
  context: string;
  sourceTitle: string;
  sourceDescription?: string | null;
  sourceSpanW: number;
  sourceSpanH: number;
  parts: SplitPartSpec[];
  languageNote?: string;
}): string {
  const sourceCells = blockFootprintCellCount(input.sourceSpanW, input.sourceSpanH);
  const partLines = input.parts
    .map(
      (p) =>
        `- index ${p.index}: cell (${p.position_y},${p.position_x}) → becomes a 1×1 baseline ILE/TAP unit`,
    )
    .join("\n");

  const parts = [
    input.context.trim(),
    SIZE_ONTOLOGY,
    `Split operation: decompose one broad multi-cell block into ${input.parts.length} single-cell (1×1) blocks.`,
    `Source block: "${input.sourceTitle}" (${input.sourceSpanW}×${input.sourceSpanH}, ${sourceCells} single-block units).`,
    describeBlockBreadthRelativeToSingle(input.sourceSpanW, input.sourceSpanH),
    input.sourceDescription?.trim()
      ? `Source description: ${input.sourceDescription.trim()}`
      : "",
    `Each result is a 1×1 baseline unit — narrower than the source (~1/${sourceCells} of its ILE/TAP breadth). Titles must be distinct focused subtopics that together reconstruct the parent scope.`,
    `Parts to name:`,
    partLines,
    `Return JSON: { "parts": [ { "index": 0, "title": "...", "description": "..." }, ... ] } with one entry per part index.`,
  ];
  if (input.languageNote?.trim()) parts.push(input.languageNote.trim());
  return parts.filter(Boolean).join("\n\n");
}

export function composeSplitBlockSystemMessage(): string {
  return [
    "You split a broad multi-cell learning block into focused 1×1 ILE/TAP units.",
    "Each part must be narrower than the parent; together they cover the parent scope.",
    'Return JSON only: { "parts": [ { "index": number, "title": string, "description": string } ] }.',
    "Title: 3-12 words each. Description: 1-2 sentences each.",
  ].join(" ");
}
