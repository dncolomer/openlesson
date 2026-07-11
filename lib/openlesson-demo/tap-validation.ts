import type { DemoWorkspaceBlock } from "./types";

const TAP_BLOCK_KEYWORDS = [
  "variance",
  "formula",
  "model",
  "pivot",
  "reconcile",
  "close",
  "revenue",
  "spreadsheet",
  "fp&a",
];

export const GRIDWORKS_TAP_VALIDATION_HINT =
  "Explain your quarter-close workbook aloud — variance totals, formula chains, and whether the close numbers are ready to publish.";

export function selectPracticeBlock(blocks: DemoWorkspaceBlock[]): DemoWorkspaceBlock | null {
  if (blocks.length === 0) return null;
  return blocks[0];
}

export function selectTapValidationBlock(
  blocks: DemoWorkspaceBlock[]
): DemoWorkspaceBlock | null {
  if (blocks.length === 0) return null;

  const scored = blocks
    .map((block) => {
      const text = `${block.title} ${block.description ?? ""}`.toLowerCase();
      let score = 0;
      for (const keyword of TAP_BLOCK_KEYWORDS) {
        if (text.includes(keyword)) score += 1;
      }
      return { block, score };
    })
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score > 0 ? scored[0].block : selectPracticeBlock(blocks);
}