"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useConfirm } from "@/lib/useConfirm";

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
}

interface SubjectRow {
  user_id: string | null;
  guest_user_id: string | null;
  embedding_model_id: string;
  as_of_ms: number;
  confidence: number;
}

function subjectKey(s: { user_id?: string | null; guest_user_id?: string | null }) {
  return `${s.user_id ?? ""}|${s.guest_user_id ?? ""}`;
}

function subjectLabel(s: SubjectRow): string {
  if (s.user_id) return `User ${s.user_id.slice(0, 8)}…`;
  if (s.guest_user_id) return `Guest ${s.guest_user_id.slice(0, 8)}…`;
  return "Workspace aggregate";
}

function isSyntheticRegion(m: { description?: string | null; subject_count?: number }): boolean {
  return Boolean(m.description?.includes("[synthetic:grok-4.5]"));
}

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
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [models, setModels] = useState<KnowledgeRegionListItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [name, setName] = useState("");
  const [syntheticName, setSyntheticName] = useState("");
  const [syntheticPrompt, setSyntheticPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [synthesizing, setSynthesizing] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/custom-verification-models?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to load custom knowledge regions");
      setSubjects(data.subjects || []);
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

  const toggle = (key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const selectedSubjects = useMemo(
    () => subjects.filter((s) => selected.has(subjectKey(s))),
    [subjects, selected],
  );

  const createFromCohort = async () => {
    if (!name.trim() || selectedSubjects.length === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/custom-verification-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create",
          workspaceId,
          name: name.trim(),
          subjects: selectedSubjects.map((s) => ({
            user_id: s.user_id,
            guest_user_id: s.guest_user_id,
            label: subjectLabel(s),
          })),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create knowledge region");
      setName("");
      setSelected(new Set());
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create knowledge region");
    } finally {
      setCreating(false);
    }
  };

  const createSynthetic = async () => {
    const prompt = syntheticPrompt.trim();
    if (!prompt) return;
    // Prefer explicit synthetic name; fall back to prompt (API requires a name).
    const resolvedName =
      syntheticName.trim() ||
      name.trim() ||
      prompt.split(/\s+/).slice(0, 6).join(" ").slice(0, 64) ||
      "Synthetic region";
    setSynthesizing(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/custom-verification-models", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "create_synthetic",
          workspaceId,
          name: resolvedName,
          prompt,
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to synthesize knowledge region");
      setSyntheticPrompt("");
      setSyntheticName("");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to synthesize knowledge region");
    } finally {
      setSynthesizing(false);
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
      const res = await fetch("/api/workspace/custom-verification-models", {
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

      // Optimistic local update so the list responds immediately; load() stays source of truth.
      setModels((prev) => {
        const next = prev.filter((m) => m.id !== region.id);
        onRegionsChange?.(next);
        return next;
      });
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to remove knowledge region");
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="w-full space-y-4" data-custom-verification-models data-custom-knowledge-regions>
      {confirmDialog}
      {error && (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      )}

      <div className="flex w-full flex-col gap-5">
        <div className="space-y-3">
          <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Create from user embeddings
          </div>
          {loading && subjects.length === 0 ? (
            <p className="text-xs text-neutral-500">Loading users with embeddings…</p>
          ) : subjects.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No knowledge config snapshots yet. Generate an LWM Snapshot so embeddings exist, then
              group users here.
            </p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto rounded-lg border border-neutral-800 p-2">
              {subjects.map((s) => {
                const key = subjectKey(s);
                const checked = selected.has(key);
                return (
                  <li key={key}>
                    <label className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-xs hover:bg-neutral-900">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(key)}
                        className="rounded border-neutral-600"
                      />
                      <span className="text-neutral-200">{subjectLabel(s)}</span>
                      <span className="ml-auto font-mono text-[10px] text-neutral-500">
                        conf {(s.confidence * 100).toFixed(0)}%
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
              className="min-w-[12rem] flex-1 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-600"
              data-region-name-input
            />
            <button
              type="button"
              disabled={creating || !name.trim() || selectedSubjects.length === 0}
              onClick={() => void createFromCohort()}
              className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-medium text-white transition hover:bg-cyan-500 disabled:opacity-40"
              data-create-cohort-region
            >
              {creating ? "Creating…" : "Create from selected users"}
            </button>
          </div>
          <p className="text-[10px] text-neutral-600">
            {selectedSubjects.length} user{selectedSubjects.length === 1 ? "" : "s"} selected ·
            groups embeddings into one knowledgecfg region
          </p>
        </div>

        <div className="space-y-3 border-t border-neutral-800 pt-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Synthesize a region
          </div>
          <p className="text-xs leading-relaxed text-neutral-500">
            Describe an ideal competency region. A profile is generated and encoded into the same
            knowledgecfg-v1-d64 space as user embeddings. Name is optional — defaults from the
            description.
          </p>
          <input
            type="text"
            value={syntheticName}
            onChange={(e) => setSyntheticName(e.target.value)}
            placeholder="Region name (optional)"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-600"
            data-synthetic-region-name
          />
          <textarea
            value={syntheticPrompt}
            onChange={(e) => setSyntheticPrompt(e.target.value)}
            rows={3}
            placeholder="e.g. Senior incident commander: calm runbook discipline, strong tool traces, high GHC under pressure…"
            className="w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white placeholder:text-neutral-600"
            data-synthetic-region-prompt
          />
          <button
            type="button"
            disabled={synthesizing || !syntheticPrompt.trim()}
            onClick={() => void createSynthetic()}
            className="rounded-lg border border-violet-700/80 bg-violet-950/50 px-3 py-2 text-xs font-medium text-violet-100 transition hover:border-violet-500 hover:text-white disabled:opacity-40"
            data-create-synthetic-region
          >
            {synthesizing ? "Generating…" : "Generate synthetic knowledge region"}
          </button>
        </div>

        <div className="space-y-3 border-t border-neutral-800 pt-4">
          <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
            Saved knowledge regions
          </div>
          <p className="text-[11px] text-neutral-500">
            Overlay regions and view Knowledge distance on the Embeddings tab.
          </p>
          {models.length === 0 ? (
            <p className="text-xs text-neutral-500">
              No custom knowledge regions yet. Group users or synthesize a region from a description.
            </p>
          ) : (
            <ul className="space-y-2" data-knowledge-regions-list>
              {models.map((m) => {
                const synthetic = isSyntheticRegion(m);
                const isDeleting = deletingId === m.id;
                return (
                  <li
                    key={m.id}
                    className="flex items-start gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
                    data-knowledge-region-id={m.id}
                  >
                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-medium text-white">{m.name}</div>
                      <div className="mt-0.5 text-[10px] text-neutral-500">
                        {synthetic ? "Synthetic" : `${m.subject_count} users · cohort`} · cohesion{" "}
                        {(m.cohort_cohesion * 100).toFixed(0)}% · threshold{" "}
                        {m.cosine_threshold.toFixed(2)}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={isDeleting || deletingId !== null}
                      onClick={() => void removeRegion(m)}
                      className="shrink-0 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-neutral-400 transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-300 disabled:cursor-not-allowed disabled:opacity-40"
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
        </div>
      </div>
    </div>
  );
}
