/**
 * Tooling description attached to a TAPBench run (agentic harness, model, notes).
 */

export interface TapbenchToolingDescription {
  agentic_harness: string | null;
  model: string | null;
  notes: string | null;
}

export class TapbenchToolingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TapbenchToolingError";
  }
}

function trimToNull(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const t = value.trim();
  return t ? t.slice(0, 2000) : null;
}

/**
 * Accept harness / model / notes (or a freeform description mapped to notes).
 * At least one field must be non-empty.
 */
export function parseTapbenchTooling(raw: unknown): TapbenchToolingDescription {
  if (raw == null) {
    throw new TapbenchToolingError(
      "tooling is required: describe the Agentic harness, model, and any notes",
    );
  }
  if (typeof raw === "string") {
    const notes = trimToNull(raw);
    if (!notes) {
      throw new TapbenchToolingError(
        "tooling description must be a non-empty Agentic harness, model, or notes",
      );
    }
    return { agentic_harness: null, model: null, notes };
  }
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new TapbenchToolingError("tooling must be an object or a description string");
  }
  const rec = raw as Record<string, unknown>;
  const agentic_harness = trimToNull(
    rec.agentic_harness ?? rec.harness ?? rec.agenticHarness,
  );
  const model = trimToNull(rec.model);
  const notes = trimToNull(rec.notes ?? rec.description);
  if (!agentic_harness && !model && !notes) {
    throw new TapbenchToolingError(
      "tooling must include an Agentic harness, model, or notes describing the run",
    );
  }
  return { agentic_harness, model, notes };
}

/** Read tooling from a PoW metadata object. Never throws. */
export function toolingFromPowMetadata(
  metadata: Record<string, unknown> | null | undefined,
): TapbenchToolingDescription {
  const rec = metadata && typeof metadata === "object" ? metadata : {};
  try {
    if (rec.tooling != null) return parseTapbenchTooling(rec.tooling);
    return parseTapbenchTooling({
      agentic_harness: rec.agentic_harness,
      model: rec.model,
      notes: rec.notes ?? rec.description,
    });
  } catch {
    return { agentic_harness: null, model: null, notes: "PoW API" };
  }
}

export function toolingIsPresent(tooling: TapbenchToolingDescription): boolean {
  return Boolean(tooling.agentic_harness || tooling.model || tooling.notes);
}
