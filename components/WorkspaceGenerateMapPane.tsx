"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { InitialChaptersPicker } from "@/components/InitialChaptersPicker";
import { generateMapHighlightCells } from "@/lib/generate-map";
import {
  DEFAULT_INITIAL_CHAPTERS,
  parseInitialChaptersLevel,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";

const MAP_TYPE_COPY: Record<string, string> = {
  initialChaptersIslands: "Islands",
  initialChaptersIslandsDesc:
    "Three core clusters with blocked corridors between them — learn each island, then build bridges.",
  initialChaptersSpiral: "Spiral",
  initialChaptersSpiralDesc:
    "Start at the core and wind outward, revisiting ideas at rising complexity.",
  initialChaptersLadder: "Ladder",
  initialChaptersLadderDesc:
    "A scaffolded climb: each rung is a prerequisite, with small practice steps off the spine.",
  initialChaptersHub: "Hub",
  initialChaptersHubDesc:
    "One foundation in the center with radiating arms to elaborate and connect.",
  initialChaptersTracks: "Tracks",
  initialChaptersTracksDesc:
    "Two parallel tracks (theory and practice) with a blocked median and a few crossing points.",
  initialChaptersRing: "Ring",
  initialChaptersRingDesc:
    "A ring around a blocked center — space practice around a core you keep returning to.",
  initialChaptersRandomSparse: "Random sparse",
  initialChaptersRandomSparseDesc:
    "A light scatter of chapters — the old Narrow count, with no named shape.",
  initialChaptersRandomDense: "Random dense",
  initialChaptersRandomDenseDesc:
    "A fuller scatter of chapters — the old Broad count, with no named shape.",
  initialChaptersPickRandom: "Pick a random type",
};

function mapTypeCopy(key: string): string {
  const suffix = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
  return MAP_TYPE_COPY[suffix] || suffix;
}

/**
 * Modifier prompt + default map-type picker for an empty cell.
 * Changing the map type only highlights the cells that Generate will fill.
 */
export function WorkspaceGenerateMapPane({
  anchorRow,
  anchorCol,
  occupied = [],
  busy = false,
  onPreviewChange,
  onSubmit,
}: {
  anchorRow: number;
  anchorCol: number;
  occupied?: Array<{ row: number; col: number }>;
  busy?: boolean;
  /** Highlight only. Does not create blocks or reload the map. */
  onPreviewChange?: (cells: Array<{ row: number; col: number }> | null) => void;
  onSubmit: (input: {
    anchorRow: number;
    anchorCol: number;
    modifier: string;
    mapTypeId: string;
  }) => Promise<void> | void;
}) {
  const [modifier, setModifier] = useState("");
  const [mapTypeId, setMapTypeId] = useState<InitialChaptersLevel>(DEFAULT_INITIAL_CHAPTERS);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onPreviewChangeRef = useRef(onPreviewChange);
  onPreviewChangeRef.current = onPreviewChange;

  const occupiedKey = useMemo(
    () =>
      occupied
        .map((cell) => `${cell.row}:${cell.col}`)
        .sort()
        .join("|"),
    [occupied],
  );
  const previewKey = useMemo(() => {
    const cells = generateMapHighlightCells({
      anchor: { row: anchorRow, col: anchorCol },
      mapTypeId,
      occupied: occupiedKey
        ? occupiedKey.split("|").map((pair) => {
            const [row, col] = pair.split(":").map(Number);
            return { row, col };
          })
        : [],
    });
    return cells.map((cell) => `${cell.row}:${cell.col}`).join(",");
  }, [anchorCol, anchorRow, mapTypeId, occupiedKey]);

  useEffect(() => {
    const cb = onPreviewChangeRef.current;
    if (!cb) return;
    if (!previewKey) {
      cb(null);
      return;
    }
    cb(
      previewKey.split(",").map((pair) => {
        const [row, col] = pair.split(":").map(Number);
        return { row, col };
      }),
    );
  }, [previewKey]);

  useEffect(() => {
    return () => {
      onPreviewChangeRef.current?.(null);
    };
  }, []);

  async function handleSubmit() {
    if (busy || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      await onSubmit({
        anchorRow,
        anchorCol,
        modifier: modifier.trim(),
        mapTypeId,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate map");
    } finally {
      setSubmitting(false);
    }
  }

  const pending = busy || submitting;

  return (
    <div className="space-y-3" data-generate-map-pane>
      <label className="block font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
        Modifier prompt
      </label>
      <textarea
        data-generate-map-modifier
        value={modifier}
        onChange={(event) => setModifier(event.target.value)}
        disabled={pending}
        rows={3}
        placeholder="Steer the new blocks — optional"
        className="w-full resize-none rounded-none border border-neutral-800 bg-neutral-900/80 px-3 py-2 text-sm text-neutral-100 outline-none focus:border-neutral-500 disabled:opacity-50"
      />
      <div data-generate-map-type-picker>
        <p className="mb-2 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Map type
        </p>
        <InitialChaptersPicker
          value={mapTypeId}
          onChange={(id) => setMapTypeId(parseInitialChaptersLevel(id))}
          disabled={pending}
          t={mapTypeCopy}
          i18nPrefix="session"
          showCountHint
        />
      </div>
      {error ? <p className="text-xs text-red-300">{error}</p> : null}
      <button
        type="button"
        data-generate-map-submit
        disabled={pending}
        onClick={() => void handleSubmit()}
        className="w-full rounded-none bg-white px-3 py-2 text-sm font-medium text-black hover:bg-neutral-200 disabled:cursor-not-allowed disabled:opacity-40"
      >
        {pending ? "Generating..." : "Generate map"}
      </button>
    </div>
  );
}
