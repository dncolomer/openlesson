/**
 * Live Learning Map selection as Helios Chat context.
 * The exclusive WorkspaceMapSelection union is shown above the composer
 * and injected into the Helios user message.
 */

import {
  emptyWorkspaceMapSelection,
  nextWorkspaceMapSelection,
  type WorkspaceMapSelection,
} from "@/lib/workspace-map-selection";
import type { HeliosMapSnapshot } from "@/lib/workspace-helios-tools";

export type HeliosSelectionChip = {
  key: string;
  label: string;
  hint: string;
};

export type HeliosSelectionContext = {
  kind: WorkspaceMapSelection["kind"];
  eyebrow: string;
  summary: string;
  chips: HeliosSelectionChip[];
  prompt: string;
  active: boolean;
};

type HeliosSelectionBlock = {
  id: string;
  title?: string | null;
  position_x?: number | null;
  position_y?: number | null;
};

const EYEBROW = "Selection";

function originHint(block: HeliosSelectionBlock | undefined): string {
  if (
    !block ||
    !Number.isFinite(Number(block.position_y)) ||
    !Number.isFinite(Number(block.position_x))
  ) {
    return "";
  }
  return `${Math.trunc(Number(block.position_y))}:${Math.trunc(Number(block.position_x))}`;
}

function titleOf(block: HeliosSelectionBlock | undefined): string {
  const title = String(block?.title || "").trim();
  return title || "Untitled block";
}

function findBlock(
  blocks: readonly HeliosSelectionBlock[],
  id: string,
): HeliosSelectionBlock | undefined {
  return blocks.find((block) => block.id === id);
}

export function serializeHeliosMapSelection(
  selection: WorkspaceMapSelection | null | undefined,
): Record<string, unknown> {
  if (!selection || selection.kind === "none") return { kind: "none" };
  if (selection.kind === "block") return { kind: "block", id: selection.id };
  if (selection.kind === "blocks") return { kind: "blocks", ids: selection.ids };
  return { kind: "empties", cells: selection.cells };
}

export function heliosMapSelectionFromUnknown(
  raw: unknown,
): WorkspaceMapSelection {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return emptyWorkspaceMapSelection();
  }
  const rec = raw as Record<string, unknown>;
  const kind = String(rec.kind || "").trim();
  if (kind === "block") {
    const id = String(
      rec.id || (Array.isArray(rec.ids) ? rec.ids[0] : "") || "",
    ).trim();
    return nextWorkspaceMapSelection({ type: "open_block", blockId: id });
  }
  if (kind === "blocks") {
    const ids = Array.isArray(rec.ids)
      ? rec.ids.map((item) => String(item))
      : [];
    return nextWorkspaceMapSelection({
      type: "set_filled_ids",
      blockIds: ids,
    });
  }
  if (kind === "empties") {
    const cells = Array.isArray(rec.cells) ? rec.cells : [];
    return nextWorkspaceMapSelection({
      type: "set_empty_cells",
      cells: cells as Array<{ row: number; col: number }>,
    });
  }
  return emptyWorkspaceMapSelection();
}

export function formatHeliosMapSelectionForPrompt(
  selection: WorkspaceMapSelection,
  snapshot: Pick<HeliosMapSnapshot, "blocks">,
): string {
  const blocks = snapshot.blocks || [];
  if (selection.kind === "block") {
    const block = findBlock(blocks, selection.id);
    return [
      "SELECTION (live map selection shown above the Helios composer)",
      "kind: block",
      `- id=${selection.id} title="${titleOf(block)}" origin=(${originHint(block) || "-"})`,
      'Prefer mutating this selected block. "this" and "it" refer to it.',
    ].join("\n");
  }
  if (selection.kind === "blocks") {
    const lines = selection.ids.map((id) => {
      const block = findBlock(blocks, id);
      return `- id=${id} title="${titleOf(block)}" origin=(${originHint(block) || "-"})`;
    });
    return [
      "SELECTION (live map selection shown above the Helios composer)",
      "kind: blocks",
      ...lines,
      'Prefer mutating these selected blocks. "these" and "them" refer to this set.',
    ].join("\n");
  }
  if (selection.kind === "empties") {
    const lines = selection.cells.map(
      (cell) => `- cell ${cell.row}:${cell.col}`,
    );
    return [
      "SELECTION (live map selection shown above the Helios composer)",
      "kind: empties",
      ...lines,
      "Place or generate on these selected empty cells.",
    ].join("\n");
  }
  return [
    "SELECTION (live map selection shown above the Helios composer)",
    "kind: none",
    "No block selected. Follow CURRENT MAP.",
  ].join("\n");
}

export function heliosSelectionContext(
  selection: WorkspaceMapSelection | null | undefined,
  snapshot: Pick<HeliosMapSnapshot, "blocks">,
): HeliosSelectionContext {
  const live = selection || emptyWorkspaceMapSelection();
  const blocks = snapshot.blocks || [];
  const prompt = formatHeliosMapSelectionForPrompt(live, snapshot);

  if (live.kind === "block") {
    const block = findBlock(blocks, live.id);
    const hint = originHint(block);
    return {
      kind: "block",
      eyebrow: EYEBROW,
      summary: titleOf(block),
      chips: [
        {
          key: live.id,
          label: titleOf(block),
          hint,
        },
      ],
      prompt,
      active: true,
    };
  }

  if (live.kind === "blocks") {
    const chips = live.ids.map((id) => {
      const block = findBlock(blocks, id);
      return {
        key: id,
        label: titleOf(block),
        hint: originHint(block),
      };
    });
    return {
      kind: "blocks",
      eyebrow: EYEBROW,
      summary: `${chips.length} blocks`,
      chips,
      prompt,
      active: true,
    };
  }

  if (live.kind === "empties") {
    const chips = live.cells.map((cell) => ({
      key: `${cell.row}:${cell.col}`,
      label: `${cell.row}:${cell.col}`,
      hint: "empty",
    }));
    return {
      kind: "empties",
      eyebrow: EYEBROW,
      summary:
        chips.length === 1 ? "1 empty cell" : `${chips.length} empty cells`,
      chips,
      prompt,
      active: true,
    };
  }

  return {
    kind: "none",
    eyebrow: EYEBROW,
    summary: "No block selected",
    chips: [],
    prompt,
    active: false,
  };
}
