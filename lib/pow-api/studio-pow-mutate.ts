/**
 * Pure + light helpers for Data Studio PoW inspect / edit / invalidate.
 * Invalidation is metadata-only (no dedicated SQL column).
 */

import {
  asMetadataRecord,
  clearPowMetadataInvalidated,
  isInvalidatedPoWMetadata,
  markPowMetadataInvalidated,
  type MarkPowInvalidatedOptions,
} from "@/lib/pow-api/pow-quality";

export type StudioPowPatchInput = {
  /** Full metadata replace/merge base when provided. */
  metadata?: unknown;
  /** When true, set invalidated flag (and optional audit). */
  invalidate?: boolean;
  /** When true, clear invalidated flag. */
  clearInvalidated?: boolean;
  invalidateOptions?: MarkPowInvalidatedOptions;
  tool_name?: string | null;
  tool_action?: string | null;
  file_name?: string | null;
};

export type StudioPowPatchResult = {
  metadata: Record<string, unknown>;
  tool_name?: string | null;
  tool_action?: string | null;
  file_name?: string | null;
  fields: Record<string, unknown>;
};

/**
 * Build the row update object for a PoW patch (metadata + optional scalar fields).
 * Always returns a new metadata object; never invents SQL columns for invalidation.
 */
export function buildStudioPowPatch(
  currentMetadata: unknown,
  input: StudioPowPatchInput,
): StudioPowPatchResult {
  let metadata: Record<string, unknown> =
    input.metadata !== undefined
      ? asMetadataRecord(input.metadata)
        ? { ...asMetadataRecord(input.metadata)! }
        : {}
      : asMetadataRecord(currentMetadata)
        ? { ...asMetadataRecord(currentMetadata)! }
        : {};

  if (input.clearInvalidated) {
    metadata = clearPowMetadataInvalidated(metadata);
  }
  if (input.invalidate) {
    metadata = markPowMetadataInvalidated(metadata, input.invalidateOptions);
  }

  const fields: Record<string, unknown> = { metadata };
  if (input.tool_name !== undefined) {
    fields.tool_name =
      typeof input.tool_name === "string" ? input.tool_name : input.tool_name;
  }
  if (input.tool_action !== undefined) {
    fields.tool_action =
      typeof input.tool_action === "string" ? input.tool_action : input.tool_action;
  }
  if (input.file_name !== undefined && typeof input.file_name === "string") {
    fields.file_name = input.file_name;
  }

  return {
    metadata,
    tool_name: fields.tool_name as string | null | undefined,
    tool_action: fields.tool_action as string | null | undefined,
    file_name: fields.file_name as string | null | undefined,
    fields,
  };
}

export function studioPowIsInvalidated(metadata: unknown): boolean {
  return isInvalidatedPoWMetadata(metadata);
}

export {
  markPowMetadataInvalidated,
  clearPowMetadataInvalidated,
  isInvalidatedPoWMetadata,
  POW_INVALIDATED_METADATA_KEY,
} from "@/lib/pow-api/pow-quality";
