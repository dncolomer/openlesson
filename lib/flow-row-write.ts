/**
 * Insert/update a product flow row. Optional columns vary by environment
 * (PostgREST schema cache). Missing columns named in the error are stripped
 * and the write is retried. Empty workspace_id is omitted so dashboard
 * creates do not send a column prod verify/calibrate tables dropped.
 */

export function omitEmptyFlowWorkspaceId(
  row: Record<string, unknown>,
): Record<string, unknown> {
  if (!("workspace_id" in row)) return { ...row };
  const value = row.workspace_id;
  const empty =
    value == null || (typeof value === "string" && value.trim() === "");
  if (!empty) return { ...row };
  const next = { ...row };
  delete next.workspace_id;
  return next;
}

export function optionalFlowColumnNamedInError(
  message: string,
  row: Record<string, unknown>,
  optionalColumns: readonly string[],
): string | null {
  const text = String(message || "");
  for (const column of optionalColumns) {
    if (!(column in row)) continue;
    if (text.includes(`'${column}'`) || text.includes(`"${column}"`)) return column;
  }
  return null;
}

export async function writeFlowRowWithOptionalColumns(
  run: (body: Record<string, unknown>) => PromiseLike<{ error: { message: string } | null }>,
  row: Record<string, unknown>,
  optionalColumns: readonly string[],
): Promise<{ error: { message: string } | null }> {
  let current = omitEmptyFlowWorkspaceId(row);
  for (;;) {
    const result = await run(current);
    if (!result.error) return result;
    const missing = optionalFlowColumnNamedInError(
      result.error.message,
      current,
      optionalColumns,
    );
    if (!missing) return result;
    const next = { ...current };
    delete next[missing];
    current = next;
  }
}
