"use client";

import {
  miniMapBounds,
  miniMapHasCell,
  miniMapInteractive,
  type MiniMapCell,
} from "@/lib/ile-chapter-mini-map";

export function ChapterMiniMap({
  cells,
  dummy = false,
  density,
}: {
  cells: MiniMapCell[];
  dummy?: boolean;
  density?: "narrow" | "mid" | "broad";
}) {
  const interactive = miniMapInteractive();
  const bounds = miniMapBounds(cells);
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
      className="pointer-events-none select-none"
    >
      <div
        className="grid gap-px"
        style={{
          gridTemplateColumns: `repeat(${cols.length}, minmax(0, 1fr))`,
        }}
      >
        {rows.flatMap((row) =>
          cols.map((col) => {
            const hit = miniMapHasCell(cells, row, col);
            const completed = hit?.status === "completed";
            return (
              <div
                key={`${row}:${col}`}
                data-mini-cell={hit ? "occupied" : "empty"}
                data-mini-cell-status={hit?.status || ""}
                className={`aspect-square rounded-[1px] ${
                  hit
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
