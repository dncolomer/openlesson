/** Stored PoW thought-trace family after the product-language cutover. */

export type StoredTraceFamily = "observation" | "action";

export function storedTraceFamily(traceType: unknown): StoredTraceFamily {
  const raw = String(traceType || "").trim().toLowerCase();
  if (raw === "action" || raw === "system2") return "action";
  return "observation";
}

export function storedTraceToolAction(traceType: unknown, action: string): string {
  return `${storedTraceFamily(traceType)}:${action}`;
}
