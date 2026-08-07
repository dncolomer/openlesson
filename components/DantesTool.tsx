"use client";

import { useEffect, useMemo, useState } from "react";

type DantesTopic = {
  slug: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
  difficulty: string[];
  resourceCount: Record<string, number>;
};

type DantesResource = {
  title: string;
  url: string;
  type: string;
  difficulty: string;
  description: string | null;
  author: string | null;
  provider: string | null;
  image: string | null;
  duration: string | null;
  isPaid: boolean;
  price: string | null;
  isAffiliate: boolean;
  affiliateLink: string | null;
  averageRating: number;
  ratingCount: number;
  upvoteCount: number;
  tags: string[];
  language: string;
};

type ScoredTopic = DantesTopic & { score: number; matchedTerms: string[] };

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  book: "Book",
  website: "Website",
  paper: "Paper",
  course: "Course",
  youtube: "YouTube",
  podcast: "Podcast",
};

const STOP_WORDS = new Set([
  "about", "after", "again", "also", "because", "before", "being", "between", "could", "does", "doing", "during", "each", "from", "have", "into", "learn", "learning", "make", "more", "most", "need", "only", "other", "should", "some", "than", "that", "their", "them", "then", "there", "these", "they", "this", "through", "under", "using", "what", "when", "where", "which", "while", "with", "work", "your",
]);

interface DantesToolProps {
  problem: string;
  activeStepDescription?: string;
}

export function DantesTool({ problem, activeStepDescription }: DantesToolProps) {
  const [topics, setTopics] = useState<DantesTopic[]>([]);
  const [topicsLoading, setTopicsLoading] = useState(true);
  const [topicsError, setTopicsError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [selectedTopic, setSelectedTopic] = useState<DantesTopic | null>(null);
  const [resources, setResources] = useState<DantesResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState<string | null>(null);

  const learningContext = [problem, activeStepDescription].filter(Boolean).join(" ");

  useEffect(() => {
    let cancelled = false;
    setTopicsLoading(true);
    setTopicsError(null);

    fetch("/api/dantes/topics")
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? `Failed to load topics (${response.status})`);
        return data as DantesTopic[];
      })
      .then((data) => {
        if (cancelled) return;
        setTopics(data);
      })
      .catch((error) => {
        if (!cancelled) setTopicsError(String(error?.message ?? error));
      })
      .finally(() => {
        if (!cancelled) setTopicsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  const rankedTopics = useMemo(() => {
    const input = query.trim() || learningContext;
    const terms = tokenize(input);
    return topics
      .map((topic) => scoreTopic(topic, terms))
      .filter((topic) => !query.trim() || topic.score > 0)
      .sort((a, b) => b.score - a.score || totalResources(b) - totalResources(a) || a.name.localeCompare(b.name));
  }, [learningContext, query, topics]);

  const suggestedTopics = query.trim() ? rankedTopics : rankedTopics.filter(topic => topic.score > 0).slice(0, 8);
  const browseTopics = query.trim() ? rankedTopics.slice(0, 40) : topics.slice(0, 40).map(topic => ({ ...topic, score: 0, matchedTerms: [] }));
  const visibleTopics = suggestedTopics.length > 0 ? suggestedTopics : browseTopics;

  useEffect(() => {
    if (selectedTopic || suggestedTopics.length === 0) return;
    setSelectedTopic(suggestedTopics[0]);
  }, [selectedTopic, suggestedTopics]);

  useEffect(() => {
    if (!selectedTopic) return;
    let cancelled = false;
    setResourcesLoading(true);
    setResourcesError(null);
    setResources([]);

    fetch(`/api/dantes/resources?topic=${encodeURIComponent(selectedTopic.slug)}`)
      .then(async (response) => {
        const data = await response.json().catch(() => null);
        if (!response.ok) throw new Error(data?.error ?? `Failed to load resources (${response.status})`);
        return data as DantesResource[];
      })
      .then((data) => {
        if (!cancelled) setResources(data);
      })
      .catch((error) => {
        if (!cancelled) setResourcesError(String(error?.message ?? error));
      })
      .finally(() => {
        if (!cancelled) setResourcesLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  return (
    <div className="flex h-full min-h-0 flex-col rounded-lg border border-neutral-800 bg-neutral-950/70">
      <div className="shrink-0 border-b border-neutral-800 p-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-semibold text-white">Dantes.io</h3>
            <p className="mt-1 text-xs text-neutral-500">Curated learning resources matched to this session.</p>
          </div>
          <span className="rounded-full border border-neutral-600/30 bg-neutral-800/10 px-2 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-neutral-300">Smart Match</span>
        </div>
        <div className="mt-4">
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search Dantes topics..."
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm text-white placeholder-neutral-600 outline-none transition-colors focus:border-neutral-600"
          />
        </div>
      </div>

      <div className="grid min-h-0 flex-1 grid-cols-1 divide-y divide-neutral-800 md:grid-cols-[300px_minmax(0,1fr)] md:divide-x md:divide-y-0">
        <div className="min-h-0 overflow-y-auto p-3">
          {topicsLoading ? (
            <StateMessage message="Loading Dantes topics..." />
          ) : topicsError ? (
            <StateMessage tone="error" message={topicsError} />
          ) : visibleTopics.length === 0 ? (
            <StateMessage message="No matching topics found." />
          ) : (
            <div className="space-y-2">
              {!query.trim() && suggestedTopics.length > 0 && (
                <p className="px-1 text-[10px] font-medium uppercase tracking-[0.16em] text-neutral-500">Best matches</p>
              )}
              {visibleTopics.map((topic) => (
                <button
                  key={topic.slug}
                  type="button"
                  onClick={() => setSelectedTopic(topic)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    selectedTopic?.slug === topic.slug
                      ? "border-neutral-600/40 bg-neutral-800/10"
                      : "border-neutral-800 bg-neutral-900/60 hover:border-neutral-700 hover:bg-neutral-900"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="text-sm font-medium text-neutral-100">{topic.name}</p>
                    <span className="shrink-0 rounded-full bg-neutral-800 px-1.5 py-0.5 text-[10px] text-neutral-400">{totalResources(topic)}</span>
                  </div>
                  <p className="mt-1 truncate text-[11px] text-neutral-500">{topic.categoryName ?? "Dantes"}{topic.subcategoryName ? ` / ${topic.subcategoryName}` : ""}</p>
                  {topic.matchedTerms.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1">
                      {topic.matchedTerms.slice(0, 3).map((term) => (
                        <span key={term} className="rounded-full border border-neutral-600/20 bg-neutral-800/10 px-1.5 py-0.5 text-[10px] text-neutral-300">{term}</span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="min-h-0 overflow-y-auto p-4">
          {!selectedTopic ? (
            <StateMessage message="Select a topic to view resources." />
          ) : (
            <div className="mx-auto max-w-3xl space-y-4">
              <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4">
                <p className="text-[11px] uppercase tracking-[0.16em] text-neutral-500">{selectedTopic.categoryName ?? "Dantes Topic"}</p>
                <h4 className="mt-1 text-xl font-semibold text-white">{selectedTopic.name}</h4>
                {selectedTopic.description && <p className="mt-2 text-sm leading-relaxed text-neutral-400">{selectedTopic.description}</p>}
                <div className="mt-3 flex flex-wrap gap-2">
                  {selectedTopic.difficulty.map((level) => (
                    <span key={level} className="rounded-full border border-neutral-700 px-2 py-1 text-[11px] capitalize text-neutral-300">{level}</span>
                  ))}
                  <span className="rounded-full border border-neutral-700 px-2 py-1 text-[11px] text-neutral-300">{totalResources(selectedTopic)} resources</span>
                </div>
              </div>

              {resourcesLoading ? (
                <StateMessage message="Loading resources..." />
              ) : resourcesError ? (
                <StateMessage tone="error" message={resourcesError} />
              ) : resources.length === 0 ? (
                <StateMessage message="No resources are published for this topic yet." />
              ) : (
                <div className="space-y-3">
                  {resources.map((resource, index) => (
                    <ResourceCard key={`${resource.url}-${index}`} resource={resource} />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function ResourceCard({ resource }: { resource: DantesResource }) {
  const href = resource.isAffiliate && resource.affiliateLink ? resource.affiliateLink : resource.url;
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="block rounded-2xl border border-neutral-800 bg-neutral-900/50 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-900"
    >
      <div className="flex items-start gap-3">
        {resource.image ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={resource.image} alt="" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg border border-neutral-800 bg-neutral-950 text-lg text-neutral-500">{resource.type.slice(0, 1).toUpperCase()}</div>
        )}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.12em] text-neutral-300">{RESOURCE_TYPE_LABELS[resource.type] ?? resource.type}</span>
            <span className="text-[11px] capitalize text-neutral-500">{resource.difficulty}</span>
            {resource.isPaid && <span className="text-[11px] text-neutral-300">{resource.price ?? "Paid"}</span>}
          </div>
          <h5 className="mt-2 text-sm font-semibold text-white">{resource.title}</h5>
          {(resource.author || resource.provider || resource.duration) && (
            <p className="mt-1 text-xs text-neutral-500">{[resource.author, resource.provider, resource.duration].filter(Boolean).join(" / ")}</p>
          )}
          {resource.description && <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-neutral-400">{resource.description}</p>}
          <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-neutral-500">
            {resource.averageRating > 0 && <span>{resource.averageRating.toFixed(1)} rating ({resource.ratingCount})</span>}
            {resource.upvoteCount > 0 && <span>{resource.upvoteCount} upvotes</span>}
            {resource.isAffiliate && <span>Affiliate link</span>}
          </div>
        </div>
      </div>
    </a>
  );
}

function StateMessage({ message, tone = "muted" }: { message: string; tone?: "muted" | "error" }) {
  return (
    <div className={`rounded-xl border p-4 text-sm ${tone === "error" ? "border-red-500/30 bg-red-500/10 text-red-300" : "border-neutral-800 bg-neutral-900/50 text-neutral-500"}`}>
      {message}
    </div>
  );
}

function scoreTopic(topic: DantesTopic, terms: string[]): ScoredTopic {
  if (terms.length === 0) return { ...topic, score: 0, matchedTerms: [] };

  const name = normalize(topic.name);
  const category = normalize(`${topic.categoryName ?? ""} ${topic.subcategoryName ?? ""}`);
  const description = normalize(topic.description ?? "");
  const slug = normalize(topic.slug.replace(/-/g, " "));
  let score = 0;
  const matchedTerms: string[] = [];

  for (const term of terms) {
    let matched = false;
    if (name.includes(term)) {
      score += 8;
      matched = true;
    }
    if (slug.includes(term)) {
      score += 6;
      matched = true;
    }
    if (category.includes(term)) {
      score += 4;
      matched = true;
    }
    if (description.includes(term)) {
      score += 2;
      matched = true;
    }
    if (matched) matchedTerms.push(term);
  }

  return { ...topic, score, matchedTerms: Array.from(new Set(matchedTerms)) };
}

function tokenize(value: string): string[] {
  return Array.from(new Set(normalize(value)
    .split(/\s+/)
    .map((term) => term.trim())
    .filter((term) => term.length > 2 && !STOP_WORDS.has(term))));
}

function normalize(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ").trim();
}

function totalResources(topic: Pick<DantesTopic, "resourceCount">) {
  return Object.values(topic.resourceCount ?? {}).reduce((sum, count) => sum + (Number.isFinite(count) ? count : 0), 0);
}
