"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/lib/useConfirm";
import { WorkspaceSectionSubTabs } from "@/components/WorkspaceSectionSubTabs";
import type { RegionBuilderSourceFilter } from "@/lib/pow-api/region-builder";
import {
  filterRegionBuilderSubjects,
  regionBuilderSubjectKey,
  type RegionBuilderSubject,
} from "@/lib/pow-api/region-builder";
/** Inner sub-tabs: Create region · Browse saved regions. */
export type KnowledgeRegionsInnerTab = "create" | "browse-regions";

export const KNOWLEDGE_REGIONS_INNER_TABS: Array<{
  id: KnowledgeRegionsInnerTab;
  label: string;
}> = [
  { id: "create", label: "Create" },
  { id: "browse-regions", label: "Browse regions" },
];

export interface KnowledgeRegionListItem {
  id: string;
  name: string;
  description: string | null;
  subject_count: number;
  cosine_threshold: number;
  cohort_cohesion: number;
  mean_radius: number;
  embedding_model_id: string;
  centroid: number[];
  created_at: string;
  workspace_id?: string;
  workspace_title?: string;
  imported?: boolean;
}

interface SubjectRow {
  user_id: string | null;
  guest_user_id: string | null;
  embedding_model_id: string;
  as_of_ms: number;
  confidence: number;
  /** human | tapbench — from PoW provenance when available. */
  pow_source?: "human" | "tapbench";
  source_link_id?: string | null;
  source_link_url?: string | null;
}

function subjectKey(s: { user_id?: string | null; guest_user_id?: string | null }) {
  return `${s.user_id ?? ""}|${s.guest_user_id ?? ""}`;
}

function subjectLabel(s: {
  user_id?: string | null;
  guest_user_id?: string | null;
  label?: string | null;
}): string {
  if (s.label) return s.label;
  if (s.user_id) return `User ${s.user_id.slice(0, 8)}…`;
  if (s.guest_user_id) return `Guest ${s.guest_user_id.slice(0, 8)}…`;
  return "Workspace aggregate";
}

function toRegionSubject(s: SubjectRow): RegionBuilderSubject {
  return {
    user_id: s.user_id,
    guest_user_id: s.guest_user_id,
    pow_source: s.pow_source === "tapbench" ? "tapbench" : "human",
    source_link_id: s.source_link_id ?? null,
    source_link_url: s.source_link_url ?? null,
    embedding_model_id: s.embedding_model_id,
    as_of_ms: s.as_of_ms,
    confidence: s.confidence,
    label: subjectLabel(s),
  };
}

function isSyntheticRegion(m: { description?: string | null; subject_count?: number }): boolean {
  return Boolean(m.description?.includes("[synthetic:grok-4.5]"));
}

/** Shared Settings primary CTA — white fill, black text (monochrome outline aesthetic). */
const PRIMARY_CTA_CLASS =
  "rounded-none bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40";

interface CustomVerificationModelsPanelProps {
  workspaceId: string;
  currentUserId: string | null;
  ayclToken?: string;
  /** Notify parent when region list changes (for embeddings overlays). */
  onRegionsChange?: (regions: KnowledgeRegionListItem[]) => void;
}

export function CustomVerificationModelsPanel({
  workspaceId,
  currentUserId: _currentUserId,
  ayclToken,
  onRegionsChange,
}: CustomVerificationModelsPanelProps) {
  void _currentUserId;
  const { confirm, confirmDialog } = useConfirm();
  const [innerTab, setInnerTab] = useState<KnowledgeRegionsInnerTab>("create");
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [models, setModels] = useState<KnowledgeRegionListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Region builder filters: human PoW vs tapbench PoW + link filter
  const [sourceFilter, setSourceFilter] = useState<RegionBuilderSourceFilter>("all");
  const [linkFilter, setLinkFilter] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const regionsRes = await fetch(
        `/api/workspace/custom-knowledge-regions?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = await regionsRes.json();
      if (!regionsRes.ok) throw new Error(data.error || "Failed to load custom knowledge regions");

      const rawSubjects: SubjectRow[] = Array.isArray(data.subjects) ? data.subjects : [];
      setSubjects(
        rawSubjects.map((s) => ({
          ...s,
          source_link_url: s.source_link_url ?? null,
        })),
      );
      const nextModels = (Array.isArray(data.models) ? data.models : []).map(
        (m: Record<string, unknown>) =>
          ({
            id: String(m.id),
            name: String(m.name),
            description: (m.description as string | null) ?? null,
            subject_count: Number(m.subject_count) || 0,
            cosine_threshold: Number(m.cosine_threshold) || 0.5,
            cohort_cohesion: Number(m.cohort_cohesion) || 0,
            mean_radius: Number(m.mean_radius) || 0,
            embedding_model_id: String(m.embedding_model_id || ""),
            centroid: Array.isArray(m.centroid) ? (m.centroid as number[]) : [],
            created_at: String(m.created_at || ""),
          }) satisfies KnowledgeRegionListItem,
      );
      setModels(nextModels);
      onRegionsChange?.(nextModels);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [onRegionsChange, workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const regionSubjects = useMemo(
    () => subjects.map(toRegionSubject),
    [subjects],
  );

  const filteredSubjects = useMemo(
    () =>
      filterRegionBuilderSubjects(regionSubjects, {
        source: sourceFilter,
        linkQuery: linkFilter,
      }),
    [regionSubjects, sourceFilter, linkFilter],
  );

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedSubjects = useMemo(
    () => filteredSubjects.filter((s) => selected.has(regionBuilderSubjectKey(s))),
    [filteredSubjects, selected],
  );

  const createFromCohort = async () => {
    if (!name.trim() || selectedSubjects.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/custom-knowledge-regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          workspaceId,
          name: name.trim(),
          subjects: selectedSubjects.map((s) => ({
            user_id: s.user_id,
            guest_user_id: s.guest_user_id,
            label: s.label || subjectLabel(s),
          })),
          pow_source: sourceFilter === "all" ? undefined : sourceFilter,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create knowledge region");
      setName("");
      setSelected(new Set());
      await load();
      setInnerTab("browse-regions");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create knowledge region");
    } finally {
      setCreating(false);
    }
  };

  const removeRegion = async (region: KnowledgeRegionListItem) => {
    const ok = await confirm({
      title: "Remove knowledge region?",
      description: `“${region.name}” will be permanently deleted. Overlays and knowledge distance for this region will no longer work.`,
      variant: "destructive",
      confirmLabel: "Remove",
      cancelLabel: "Cancel",
    });
    if (!ok) return;

    setDeletingId(region.id);
    setError(null);
    try {
      const res = await fetch("/api/workspace/custom-knowledge-regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete",
          workspaceId,
          modelId: region.id,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to remove knowledge region");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove knowledge region");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div
      className="w-full"
      data-custom-verification-models
      data-custom-knowledge-regions
      data-knowledge-regions-subtabs
    >
      {confirmDialog}
      {error && (
        <div className="mb-3 rounded-none border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div
        className="rounded-none border border-neutral-800/80 bg-neutral-950/75 backdrop-blur-md"
        data-knowledge-regions-inner-tabs
      >
        <WorkspaceSectionSubTabs
          activeId={innerTab}
          onChange={setInnerTab}
          tabs={KNOWLEDGE_REGIONS_INNER_TABS}
          ariaLabel="Knowledge Regions sections"
        />

        {/* ── Create: region builder ── */}
        {innerTab === "create" ? (
          <div
            className="flex flex-col gap-4 p-5 sm:p-6"
            data-knowledge-regions-inner-tab="create"
            data-region-create-tab
            role="tabpanel"
          >
            <section className="space-y-3" data-region-builder data-region-create-cohort>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Region builder
                </div>
                <p className="mt-1 text-xs leading-relaxed text-neutral-500">
                  Build regions from actual human PoW or tapbench PoW. Filter by source and by link
                  / TAPBench link id or URL.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2" data-region-builder-filters>
                <select
                  value={sourceFilter}
                  onChange={(e) =>
                    setSourceFilter(e.target.value as RegionBuilderSourceFilter)
                  }
                  className="rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
                  data-region-source-filter
                >
                  <option value="all">All PoW sources</option>
                  <option value="human">Human PoW</option>
                  <option value="tapbench">Tapbench PoW</option>
                </select>
                <input
                  type="text"
                  value={linkFilter}
                  onChange={(e) => setLinkFilter(e.target.value)}
                  placeholder="Filter by link / TAPBench link id or URL"
                  className="min-w-[14rem] flex-1 rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-600"
                  data-region-link-filter
                />
              </div>

              {loading && filteredSubjects.length === 0 ? (
                <p className="text-xs text-neutral-500">Loading subjects with embeddings…</p>
              ) : filteredSubjects.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No subjects match this filter. Generate an LWM Snapshot after human TAP or
                  TAPBench sessions so embeddings exist.
                </p>
              ) : (
                <ul className="max-h-48 space-y-1 overflow-y-auto rounded-none border border-neutral-800 p-2">
                  {filteredSubjects.map((s) => {
                    const key = regionBuilderSubjectKey(s);
                    const checked = selected.has(key);
                    return (
                      <li key={key}>
                        <label className="flex cursor-pointer items-center gap-2 rounded-none px-2 py-1.5 text-xs hover:bg-neutral-900">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggle(key)}
                            className="rounded-none border-neutral-600"
                          />
                          <span className="text-neutral-200">
                            {s.label || subjectLabel(s)}
                          </span>
                          <span
                            className="rounded-none border border-neutral-700 px-1.5 py-0.5 text-[10px] text-neutral-400"
                            data-pow-source={s.pow_source}
                          >
                            {s.pow_source}
                          </span>
                          {s.source_link_id ? (
                            <span className="font-mono text-[10px] text-neutral-600">
                              {s.source_link_id.slice(0, 8)}…
                            </span>
                          ) : null}
                          <span className="ml-auto font-mono text-[10px] text-neutral-500">
                            conf {((s.confidence ?? 0) * 100).toFixed(0)}%
                          </span>
                        </label>
                      </li>
                    );
                  })}
                </ul>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Region name (e.g. Production SRE bar)"
                  className="min-w-[12rem] flex-1 rounded-none border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-600"
                  data-region-name-input
                />
                <button
                  type="button"
                  disabled={creating || !name.trim() || selectedSubjects.length === 0}
                  onClick={() => void createFromCohort()}
                  className={PRIMARY_CTA_CLASS}
                  data-create-cohort-region
                >
                  {creating ? "Creating…" : "Create from selected"}
                </button>
              </div>
              <p className="text-[10px] text-neutral-600">
                {selectedSubjects.length} subject
                {selectedSubjects.length === 1 ? "" : "s"} selected · filter: {sourceFilter}
                {linkFilter.trim() ? ` · link “${linkFilter.trim()}”` : ""}
              </p>
            </section>
          </div>
        ) : null}

        {/* ── Browse created regions ── */}
        {innerTab === "browse-regions" ? (
          <div
            className="flex flex-col gap-4 p-5 sm:p-6"
            data-knowledge-regions-inner-tab="browse-regions"
            data-region-browse-tab
            role="tabpanel"
          >
            <section className="space-y-3" data-region-saved-list>
              <div>
                <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
                  Saved knowledge regions
                </div>
                <p className="mt-1 text-[11px] text-neutral-500">
                  Overlay regions and view Knowledge distance on the Embeddings tab.
                </p>
              </div>
              {loading && models.length === 0 ? (
                <p className="text-xs text-neutral-500">Loading regions…</p>
              ) : models.length === 0 ? (
                <p className="text-xs text-neutral-500">
                  No custom knowledge regions yet. Create one from human or tapbench PoW on the
                  Create tab.
                </p>
              ) : (
                <ul className="space-y-2" data-knowledge-regions-list>
                  {models.map((m) => {
                    const synthetic = isSyntheticRegion(m);
                    const isDeleting = deletingId === m.id;
                    return (
                      <li
                        key={m.id}
                        className="flex items-start gap-3 rounded-none border border-neutral-800 bg-neutral-900/50 p-3"
                        data-knowledge-region-id={m.id}
                      >
                        <div className="min-w-0 flex-1">
                          <div className="text-sm font-medium text-white">{m.name}</div>
                          <div className="mt-0.5 text-[10px] text-neutral-500">
                            {synthetic ? "Custom" : `${m.subject_count} users · cohort`} · cohesion{" "}
                            {(m.cohort_cohesion * 100).toFixed(0)}% · threshold{" "}
                            {m.cosine_threshold.toFixed(2)}
                          </div>
                        </div>
                        <button
                          type="button"
                          disabled={isDeleting || deletingId !== null}
                          onClick={() => void removeRegion(m)}
                          className="shrink-0 rounded-none border border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
                          data-remove-knowledge-region={m.id}
                          title={`Remove ${m.name}`}
                        >
                          {isDeleting ? "Removing…" : "Remove"}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          </div>
        ) : null}
      </div>
    </div>
  );
}
