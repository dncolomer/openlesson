/**
 * Column filters + pagination for the TAPBench results table.
 */

export const TAPBENCH_RESULTS_PAGE_SIZE = 10;

export function matchTapbenchColFilter(
  filterRaw: string,
  cell: { text: string; value?: number | null },
): boolean {
  const filter = filterRaw.trim();
  if (!filter) return true;
  const cmp = filter.match(/^(>=|<=|>|<|=)\s*(-?\d+(?:\.\d+)?)$/);
  if (cmp) {
    if (cell.value == null || !Number.isFinite(cell.value)) return false;
    const n = Number(cmp[2]);
    const op = cmp[1];
    if (op === ">") return cell.value > n;
    if (op === ">=") return cell.value >= n;
    if (op === "<") return cell.value < n;
    if (op === "<=") return cell.value <= n;
    return cell.value === n;
  }
  return cell.text.toLowerCase().includes(filter.toLowerCase());
}

export function paginateTapbenchRows<T>(
  rows: T[],
  page: number,
  pageSize: number = TAPBENCH_RESULTS_PAGE_SIZE,
): {
  page: number;
  pages: number;
  slice: T[];
  from: number;
  to: number;
  total: number;
} {
  const size = pageSize > 0 ? pageSize : TAPBENCH_RESULTS_PAGE_SIZE;
  const total = rows.length;
  const pages = Math.max(1, Math.ceil(total / size) || 1);
  const safePage = Math.min(Math.max(1, page), pages);
  const start = (safePage - 1) * size;
  const slice = rows.slice(start, start + size);
  return {
    page: safePage,
    pages,
    slice,
    from: total === 0 ? 0 : start + 1,
    to: start + slice.length,
    total,
  };
}
