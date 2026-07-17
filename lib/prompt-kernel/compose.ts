import { WORKSPACE_ONTOLOGY, WORKSPACE_ONTOLOGY_COMPACT } from "./ontology";

export type OntologyDensity = "full" | "compact" | "none";

export interface ComposePromptOptions {
  /** L0 philosophy density */
  ontology?: OntologyDensity;
  /** L1 product surface language */
  surface?: string | null;
  /** L2 task contract / instructions */
  task: string;
  /** Optional extra runtime notes (not the file attachments themselves) */
  contextNotes?: string | null;
}

/**
 * Layered prompt composition: ontology → surface → task → context notes.
 */
export function composePrompt(options: ComposePromptOptions): string {
  const parts: string[] = [];
  const density = options.ontology ?? "full";

  if (density === "full") {
    parts.push(WORKSPACE_ONTOLOGY);
  } else if (density === "compact") {
    parts.push(WORKSPACE_ONTOLOGY_COMPACT);
  }

  if (options.surface?.trim()) {
    parts.push(options.surface.trim());
  }

  parts.push(options.task.trim());

  if (options.contextNotes?.trim()) {
    parts.push(options.contextNotes.trim());
  }

  return parts.filter(Boolean).join("\n\n");
}
