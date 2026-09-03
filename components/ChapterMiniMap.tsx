"use client";

import {
  miniMapBounds,
  miniMapDummyFrame,
  miniMapHasCell,
  miniMapInteractive,
  type MiniMapCell,
} from "@/lib/ile-chapter-mini-map";
import type { InitialChaptersLevel } from "@/lib/initial-chapters";

export function ChapterMiniMap({
  cells,
  dummy = false,
  density,
}: {
  cells: MiniMapCell[];
  dummy?: boolean;
  density?: InitialChaptersLevel | string;
}) {
  const interactive = miniMapInteractive();
  const bounds = dummy ? miniMapDummyFrame() : miniMapBounds(cells);
  const rows: number[] = [];
  const cols: number[] = [];
  for (let r = bounds.minRow; r <= bounds.maxRow; r += 1) rows.push(r);
  for (let c = bounds.minCol; c <= bounds.maxCol; c += 1) cols.push(c);

  return (
    <div
      data-chapter-mini-map
      data-chapter-mini-map-dummy={dummy ? "true" : "false"}
      data-chapter-mini-interactive={interactive ? "true" : "false"}
      {...(density ? { "data-density-dummy-map": density } : {})}
      aria-hidden="true"
      className="pointer-events-none h-full w-full select-none"
    >
      <div
        className="grid h-full w-full gap-px"
        style={{
          gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
          gridTemplateRows: `repeat(${rows.length}, minmax(0, 1fr))`,
        }}
      >
        {rows.flatMap((row) =>
          cols.map((col) => {
            const hit = miniMapHasCell(cells, row, col);
            const blocked = hit?.kind === "blocked";
            const noSpawn = hit?.kind === "no_spawn";
            const dagHint = hit?.kind === "dag_hint";
            const completed = hit?.status === "completed";
            const cellKind = blocked
              ? "blocked"
              : noSpawn
                ? "no_spawn"
                : dagHint
                  ? "dag_hint"
                  : hit
                    ? "occupied"
                    : "empty";
            return (
              <div
                key={`${row}:${col}`}
                data-mini-cell={cellKind}
                data-mini-cell-status={hit?.status || ""}
                className={`min-h-0 min-w-0 rounded-[1px] ${
                  blocked
                    ? "bg-[repeating-linear-gradient(135deg,rgba(64,64,64,0.95)_0_2px,rgba(24,24,24,0.95)_2px_4px)]"
                    : noSpawn
                      ? "bg-neutral-950 ring-1 ring-inset ring-rose-900/60"
                      : dagHint
                        ? "bg-sky-900/70"
                        : hit
                          ? completed
                            ? "bg-neutral-200"
                            : "bg-neutral-400"
                          : "bg-neutral-800"
                }`}
              />
            );
          }),
        )}
      </div>
    </div>
  );
}
