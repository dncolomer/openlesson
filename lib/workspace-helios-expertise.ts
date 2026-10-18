/**
 * Helios as a Learning Map expert: pedagogy, spatial craft, and the
 * official map-type library. Live workspace types are injected per turn.
 */

import {
  MAP_TYPE_LIBRARY,
  MAP_TYPE_LIBRARY_BY_ID,
  MAP_TYPE_LIBRARY_CORE,
  MAP_TYPE_LIBRARY_EXTRAS,
  type MapTypeLibraryEntry,
} from "@/lib/map-type-library";

export type HeliosWorkspaceMapTypesPayload = {
  selectedLibraryIds?: string[];
  custom?: Array<{ id: string; label: string; description: string }>;
};

function firstSentence(text: string): string {
  const trimmed = String(text || "").replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  const cut = trimmed.match(/^(.+?[.!?])(\s|$)/);
  return (cut?.[1] || trimmed).trim();
}

function lineFor(entry: MapTypeLibraryEntry): string {
  const when = firstSentence(entry.useWhen);
  return [
    `- ${entry.id} "${entry.label}" [${entry.categoryLabel} / ${entry.strengthLabel}]: ${entry.description}`,
    when ? `Use when: ${when}` : "",
    entry.layoutInstruction,
  ]
    .filter(Boolean)
    .join(" ");
}

export function heliosMapExpertiseText(): string {
  return [
    "LEARNING MAP EXPERTISE",
    "You are a Learning Map expert. A Learning Map is pedagogy on a 2D skill grid, not a linear syllabus.",
    "When the author names a topic, decide how someone should learn it, then pick a map type and realize that type on the plane.",
    "Ask, internally: what must become automatic vs stay a whole task; whether cores should stay separate until later bridges, or the whole should be visible first; whether walks are prerequisite-heavy, recrossed, or parallel strands.",
    "Spatial structure is the teaching: adjacent cells are related; blocked/unusable cells are corridors and walls; DAG next/lock edges are prerequisites. Do not dump a row of blocks.",
    "Name the map type in the short reply, then build it with tools in the same turn: add_block / generate_shape for the skeleton, mark_unusable for blocked corridors, apply_dag along the walk, cluster_blocks for islands, 1-cell bridge_blocks only where the type wants a crossing.",
    "Translate the type's skeleton so the foundation sits at the origin (0,0) unless that cell is occupied. Keep ~80% resemblance to the named type; do not 1:1-copy every library cell if the topic needs a tighter map.",
    "Prefer a shaped official type (Islands, Ladder, Hub, Tracks, Ring, Spiral, Funnel, Hourglass, Chambers, …) over Random sparse/dense unless the author asks for scatter.",
  ].join("\n");
}

export function heliosMapTypeAwarenessText(
  entries: readonly MapTypeLibraryEntry[] = MAP_TYPE_LIBRARY,
): string {
  const core = entries.filter((entry) => entry.category === "core");
  const extras = entries.filter((entry) => entry.category !== "core");
  const coreList = (core.length ? core : MAP_TYPE_LIBRARY_CORE).map(lineFor);
  const extraList = (extras.length ? extras : MAP_TYPE_LIBRARY_EXTRAS).map(
    lineFor,
  );
  return [
    "MAP TYPES (official Learning Map topologies available to Helios)",
    "These are the Map Types catalog. Pick one that fits how this topic is learned. Build it with tools — do not only name it.",
    "CORE (on every new workspace):",
    ...coreList,
    "LIBRARY EXTRAS (available when they fit the topic):",
    ...extraList,
  ].join("\n");
}

export function serializeHeliosWorkspaceMapTypes(state: {
  selectedLibraryIds?: readonly string[] | null;
  customTypes?: readonly {
    id?: string;
    label?: string;
    description?: string;
    enabled?: boolean;
  }[] | null;
} | null | undefined): HeliosWorkspaceMapTypesPayload {
  const selectedLibraryIds = [
    ...new Set(
      (state?.selectedLibraryIds || [])
        .map((id) => String(id || "").trim())
        .filter(Boolean),
    ),
  ];
  const custom = (state?.customTypes || [])
    .filter((item) => item && item.enabled !== false)
    .map((item) => ({
      id: String(item.id || "").trim(),
      label: String(item.label || "").trim() || "Custom map type",
      description: String(item.description || "").trim(),
    }))
    .filter((item) => item.id);
  return { selectedLibraryIds, custom };
}

export function heliosWorkspaceMapTypesFromUnknown(
  raw: unknown,
): HeliosWorkspaceMapTypesPayload {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { selectedLibraryIds: [], custom: [] };
  }
  const rec = raw as Record<string, unknown>;
  return serializeHeliosWorkspaceMapTypes({
    selectedLibraryIds: Array.isArray(rec.selectedLibraryIds)
      ? rec.selectedLibraryIds.map((id) => String(id))
      : Array.isArray(rec.selected_library_ids)
        ? rec.selected_library_ids.map((id) => String(id))
        : [],
    customTypes: Array.isArray(rec.custom)
      ? rec.custom
      : Array.isArray(rec.customTypes)
        ? rec.customTypes
        : [],
  });
}

export function formatHeliosWorkspaceMapTypesForPrompt(
  payload: HeliosWorkspaceMapTypesPayload,
): string {
  const ids = payload.selectedLibraryIds || [];
  const custom = payload.custom || [];
  if (ids.length === 0 && custom.length === 0) return "";
  const official = ids.map((id) => {
    const entry = MAP_TYPE_LIBRARY_BY_ID[id];
    return entry
      ? `- ${entry.id} "${entry.label}" [${entry.categoryLabel}]`
      : `- ${id}`;
  });
  const customLines = custom.map(
    (item) =>
      `- ${item.id} "${item.label}" [custom]${item.description ? `: ${item.description}` : ""}`,
  );
  return [
    "WORKSPACE MAP TYPES (enabled on this workspace — prefer one of these when it fits)",
    ...official,
    ...customLines,
  ].join("\n");
}
