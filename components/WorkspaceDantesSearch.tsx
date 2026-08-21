"use client";

import { useEffect, useMemo, useState } from "react";
import {
  externalResourceFromDantes,
  type ExternalResourceCreateInput,
} from "@/lib/workspace-external-resources";

type DantesTopic = {
  slug: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  difficulty?: string[];
  resourceCount?: Record<string, number>;
};

type DantesResource = {
  title: string;
  url: string;
  type: string;
  difficulty: string;
  description: string | null;
  author?: string | null;
  provider?: string | null;
};

/**
 * Compact Dantes topic/resource search for the Context tab.
 * Picking a resource calls onAdd with a normalized create payload.
 */
export function WorkspaceDantesSearch({
  canEdit,
  onAdd,
  busy,
  seedQuery,
}: {
  canEdit: boolean;
  onAdd: (payload: ExternalResourceCreateInput) => Promise<void> | void;
  busy?: boolean;
  seedQuery?: string | null;
}) {
  const [topics, setTopics] = useState<DantesTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [query, setQuery] = useState(seedQuery?.trim() || "");
  const [selectedTopic, setSelectedTopic] = useState<DantesTopic | null>(null);
  const [resources, setResources] = useState<DantesResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);
  const [addingKey, setAddingKey] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setTopicsLoading(true);
    setTopicsError(null);
    fetch("/api/dantes/topics")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
        return data as DantesTopic[];
      })
      .then((data) => {
        if (!cancelled) setTopics(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setTopicsError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setTopicsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filteredTopics = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return topics.slice(0, 24);
    return topics
      .filter((t) => {
        const hay = [
          t.name,
          t.description,
          t.categoryName,
          t.subcategoryName,
          t.slug,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        return hay.includes(q);
      })
      .slice(0, 24);
  }, [query, topics]);

  useEffect(() => {
    if (!selectedTopic) {
      setResources([]);
      return;
    }
    let cancelled = false;
    setResourcesLoading(true);
    setResourcesError(null);
    setResources([]);
    fetch(`/api/dantes/resources?topic=${encodeURIComponent(selectedTopic.slug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? `Failed (${res.status})`);
        return data as DantesResource[];
      })
      .then((data) => {
        if (!cancelled) setResources(Array.isArray(data) ? data : []);
      })
      .catch((err) => {
        if (!cancelled) setResourcesError(String(err?.message ?? err));
      })
      .finally(() => {
        if (!cancelled) setResourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  const addResource = async (resource: DantesResource, index: number) => {
    if (!canEdit || busy) return;
    const key = `${resource.url}:${index}`;
    setAddingKey(key);
    try {
      await onAdd(
        externalResourceFromDantes({
          title: resource.title,
          url: resource.url,
          type: resource.type,
          description: resource.description,
          difficulty: resource.difficulty,
          topicSlug: selectedTopic?.slug,
          source: "dantes",
        }),
      );
    } finally {
      setAddingKey(null);
    }
  };

  return (
    <div
      data-workspace-dantes-search
      className="space-y-3 rounded-none border border-neutral-800/80 bg-neutral-950/90 p-3 sm:p-4"
    >
      <div>
        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-500">
          Dantes search
        </p>
      </div>

      <input
        data-dantes-search-query
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search topics…"
        disabled={!canEdit}
        className="w-full rounded-none border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs text-neutral-200 placeholder:text-neutral-600 disabled:opacity-50"
      />

      {topicsLoading ? (
        <p className="text-[11px] text-neutral-600">Loading topics…</p>
      ) : topicsError ? (
        <p className="text-[11px] text-neutral-300/90" data-dantes-topics-error>
          {topicsError}
        </p>
      ) : (
        <ul
          data-dantes-topic-list
          className="max-h-36 space-y-1 overflow-y-auto rounded-none border border-neutral-800/80 p-1"
        >
          {filteredTopics.map((topic) => {
            const active = selectedTopic?.slug === topic.slug;
            return (
              <li key={topic.slug}>
                <button
                  type="button"
                  data-dantes-topic={topic.slug}
                  disabled={!canEdit}
                  onClick={() => setSelectedTopic(topic)}
                  className={`w-full rounded-none px-2 py-1.5 text-left text-[11px] transition ${
                    active
                      ? "bg-white/10 text-white"
                      : "text-neutral-400 hover:bg-white/5 hover:text-neutral-200"
                  }`}
                >
                  <span className="font-medium">{topic.name}</span>
                  {topic.categoryName ? (
                    <span className="ml-1 text-neutral-600">{topic.categoryName}</span>
                  ) : null}
                </button>
              </li>
            );
          })}
          {filteredTopics.length === 0 ? (
            <li className="px-2 py-2 text-[11px] text-neutral-600">No topics match.</li>
          ) : null}
        </ul>
      )}

      {selectedTopic ? (
        <div data-dantes-resource-list className="space-y-1.5">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-600">
            Resources · {selectedTopic.name}
          </p>
          {resourcesLoading ? (
            <p className="text-[11px] text-neutral-600">Loading resources…</p>
          ) : resourcesError ? (
            <p className="text-[11px] text-neutral-300/90">{resourcesError}</p>
          ) : (
            <ul className="max-h-48 space-y-1 overflow-y-auto">
              {resources.map((resource, index) => {
                const key = `${resource.url}:${index}`;
                return (
                  <li
                    key={key}
                    data-dantes-resource={resource.url}
                    className="flex items-start justify-between gap-2 rounded-none border border-neutral-800/70 bg-black/30 px-2 py-1.5"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-[11px] font-medium text-neutral-200">
                        {resource.title}
                      </p>
                      <p className="truncate text-[10px] text-neutral-600">
                        {[resource.type, resource.difficulty].filter(Boolean).join(" · ")}
                      </p>
                    </div>
                    {canEdit ? (
                      <button
                        type="button"
                        data-dantes-add-resource
                        disabled={busy || addingKey === key}
                        onClick={() => void addResource(resource, index)}
                        className="shrink-0 rounded-none border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-medium text-white disabled:opacity-40"
                      >
                        {addingKey === key ? "Adding…" : "Add"}
                      </button>
                    ) : null}
                  </li>
                );
              })}
              {resources.length === 0 && !resourcesLoading ? (
                <li className="text-[11px] text-neutral-600">No resources for this topic.</li>
              ) : null}
            </ul>
          )}
        </div>
      ) : null}
    </div>
  );
}
