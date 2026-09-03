"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { Footer } from "@/components/Footer";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";
import { trackWorkspaceCreated } from "@/lib/analytics";
import { InitialChaptersPicker } from "@/components/InitialChaptersPicker";
import {
  DEFAULT_INITIAL_CHAPTERS,
  getInitialChaptersBand,
  type InitialChaptersLevel,
} from "@/lib/initial-chapters";
import {
  UI_WORKSPACE_CREATE_MODES,
  isUiWorkspaceCreateMode,
  resolveWorkspaceCreateOverlay,
  type WorkspaceCreateMode,
} from "@/lib/workspace-create-modes";
import {
  AYCL_FULL_PRICE_LABEL,
  AYCL_LEARNER_PRICE_LABEL,
} from "@/lib/aycl-shared";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

const BACKGROUND_IMAGES = [
  "/aesthetics/Greco-futurism/HHnTrgVaQAAP-_3.jpeg",
  "/aesthetics/Greco-futurism/HHnTrf2acAA1Juo.jpeg",
  "/aesthetics/Greco-futurism/HHnTrlMaAAAg_4I.jpeg",
  "/aesthetics/Greco-futurism/HHnTrjJbQAAOz7K.jpeg",
];

function startingSizeCopy(key: string): string {
  const suffix = key.includes(".") ? key.slice(key.indexOf(".") + 1) : key;
  const catalog: Record<string, string> = {
    initialChaptersIslands: "Islands",
    initialChaptersIslandsDesc:
      "Three core clusters with blocked corridors between them — learn each island, then build bridges.",
    initialChaptersSpiral: "Spiral",
    initialChaptersSpiralDesc:
      "Start at the core and wind outward, revisiting ideas at rising complexity.",
    initialChaptersLadder: "Ladder",
    initialChaptersLadderDesc:
      "A scaffolded climb: each rung is a prerequisite, with small practice steps off the spine.",
    initialChaptersHub: "Hub",
    initialChaptersHubDesc:
      "One foundation in the center with radiating arms to elaborate and connect.",
    initialChaptersTracks: "Tracks",
    initialChaptersTracksDesc:
      "Two parallel tracks (theory and practice) with a blocked median and a few crossing points.",
    initialChaptersRing: "Ring",
    initialChaptersRingDesc:
      "A ring around a blocked center — space practice around a core you keep returning to.",
    initialChaptersRandomSparse: "Random sparse",
    initialChaptersRandomSparseDesc:
      "A light scatter of chapters — the old Narrow count, with no named shape.",
    initialChaptersRandomDense: "Random dense",
    initialChaptersRandomDenseDesc:
      "A fuller scatter of chapters — the old Broad count, with no named shape.",
    initialChaptersPickRandom: "Random (pick a random type)",
  };
  return catalog[suffix] || suffix;
}

type DantesTopic = {
  slug: string;
  name: string;
  description: string | null;
  categoryName: string | null;
  subcategoryName: string | null;
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
  image?: string | null;
};

const RESOURCE_TYPE_LABELS: Record<string, string> = {
  video: "Video",
  book: "Book",
  website: "Website",
  paper: "Paper",
  course: "Course",
  youtube: "YouTube",
  podcast: "Podcast",
};

function resourceKey(resource: DantesResource, index: number) {
  return resource.url || `${resource.title}:${index}`;
}

function totalTopicResources(topic: DantesTopic) {
  return Object.values(topic.resourceCount ?? {}).reduce(
    (sum, count) => sum + (Number.isFinite(count) ? count : 0),
    0,
  );
}

const MODE_CARD_COPY: Record<
  "blank" | "template" | "knowledge_region",
  { title: string; description: string; badge: string; details: string[]; cta: string }
> = {
  blank: {
    title: "Blank",
    description:
      "An empty skill grid with no generated blocks. Creates immediately so you can place the first tiles yourself.",
    badge: "Start empty",
    details: [
      "Empty skill grid — no generated blocks",
      "Creates immediately, no setup step",
      "Add, drag, and shape the map yourself",
    ],
    cta: "Create blank workspace",
  },
  template: {
    title: "From Template",
    description:
      "Start from a topic library. Curated resources become generation context for the first map.",
    badge: "Topic + size",
    details: [
      "Browse categories, then pick a topic",
      "Choose which resources to include as context",
      "Set a starting size before the map is generated",
    ],
    cta: "Choose a template",
  },
  knowledge_region: {
    title: "Knowledge Region",
    description:
      "Goals, Knowledge, and Settings only. Proof of work is generated elsewhere — this workspace does not mint questions, exercises, or knowledge links.",
    badge: "External PoW",
    details: [
      "Tabs: Goals, Knowledge, Settings",
      "No generated map or knowledge links",
      "Bring your own proof of work",
    ],
    cta: "Create knowledge region",
  },
};

const AYCL_CARD = {
  title: "All You Can Learn",
  badge: "Marketplace",
  description:
    "Ready-made workspaces you can practice on or fork. One-time lifetime packages.",
  details: [
    `Practice from ${AYCL_LEARNER_PRICE_LABEL} · full pack ${AYCL_FULL_PRICE_LABEL}`,
    "Curated maps for topics that already exist",
    "Skip the blank-page start and jump into a live grid",
  ],
  cta: "Explore AYCL",
  href: "/all-you-can-learn",
};

const START_CARD_CLASS =
  "group flex h-full min-h-[22rem] flex-col rounded-none border border-zinc-800 bg-zinc-950/90 p-5 text-left transition hover:border-zinc-500 hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-white/30";

const KR_SPAN_CARD_CLASS =
  "group flex w-full min-h-0 flex-col rounded-none border border-zinc-800 bg-zinc-950/90 p-5 text-left transition hover:border-zinc-500 hover:bg-zinc-900/90 focus:outline-none focus:ring-2 focus:ring-white/30 disabled:cursor-not-allowed disabled:opacity-50 md:flex-row md:items-center md:gap-6";

const MODE_CARDS = UI_WORKSPACE_CREATE_MODES.map((mode) => ({
  mode,
  ...MODE_CARD_COPY[mode as "blank" | "template" | "knowledge_region"],
}));

const PRIMARY_MODE_CARDS = MODE_CARDS.filter((card) => card.mode !== "knowledge_region");
const KNOWLEDGE_REGION_CARD = MODE_CARDS.find((card) => card.mode === "knowledge_region")!;

export default function NewWorkspacePage() {
  const [step, setStep] = useState<1 | 2>(1);
  const [mode, setMode] = useState<WorkspaceCreateMode | null>(null);
  const [bgImage, setBgImage] = useState("");
  const [initialChapters, setInitialChapters] = useState<InitialChaptersLevel>(
    DEFAULT_INITIAL_CHAPTERS,
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();

  // Template topic library
  const [dantesTopics, setDantesTopics] = useState<DantesTopic[]>([]);
  const [dantesLoading, setDantesLoading] = useState(false);
  const [dantesQuery, setDantesQuery] = useState("");
  const [browseCategory, setBrowseCategory] = useState<string | null>(null);
  const [browseSubcategory, setBrowseSubcategory] = useState<string | null>(null);
  const [selectedTopic, setSelectedTopic] = useState<DantesTopic | null>(null);
  const [dantesResources, setDantesResources] = useState<DantesResource[]>([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  /** Keys of resources included as generation context (default: all). */
  const [selectedResourceKeys, setSelectedResourceKeys] = useState<Set<string>>(new Set());

  const supabase = useMemo(() => createClient(), []);

  useEffect(() => {
    setBgImage(BACKGROUND_IMAGES[Math.floor(Math.random() * BACKGROUND_IMAGES.length)]);
  }, []);

  useEffect(() => {
    if (mode !== "template" || step !== 2) return;
    let cancelled = false;
    setDantesLoading(true);
    fetch("/api/dantes/topics")
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Failed to load topics");
        return data as DantesTopic[];
      })
      .then((topics) => {
        if (!cancelled) setDantesTopics(Array.isArray(topics) ? topics : []);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load topics");
      })
      .finally(() => {
        if (!cancelled) setDantesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [mode, step]);

  useEffect(() => {
    if (!selectedTopic) {
      setDantesResources([]);
      setSelectedResourceKeys(new Set());
      setResourcesLoading(false);
      return;
    }
    let cancelled = false;
    setResourcesLoading(true);
    setDantesResources([]);
    setSelectedResourceKeys(new Set());
    fetch(`/api/dantes/resources?topic=${encodeURIComponent(selectedTopic.slug)}`)
      .then(async (res) => {
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error || "Failed to load resources");
        return data as DantesResource[];
      })
      .then((resources) => {
        if (cancelled) return;
        const list = Array.isArray(resources) ? resources : [];
        setDantesResources(list);
        // Default: include all resources as context
        setSelectedResourceKeys(new Set(list.map((r, i) => resourceKey(r, i))));
      })
      .catch(() => {
        if (!cancelled) {
          setDantesResources([]);
          setSelectedResourceKeys(new Set());
        }
      })
      .finally(() => {
        if (!cancelled) setResourcesLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedTopic]);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of dantesTopics) {
      const cat = (t.categoryName || "Other").trim() || "Other";
      map.set(cat, (map.get(cat) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [dantesTopics]);

  const subcategories = useMemo(() => {
    if (!browseCategory) return [];
    const map = new Map<string, number>();
    for (const t of dantesTopics) {
      const cat = (t.categoryName || "Other").trim() || "Other";
      if (cat !== browseCategory) continue;
      const sub = (t.subcategoryName || "General").trim() || "General";
      map.set(sub, (map.get(sub) || 0) + 1);
    }
    return Array.from(map.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [browseCategory, dantesTopics]);

  const topicsInBrowse = useMemo(() => {
    if (!browseCategory || !browseSubcategory) return [];
    return dantesTopics
      .filter((t) => {
        const cat = (t.categoryName || "Other").trim() || "Other";
        const sub = (t.subcategoryName || "General").trim() || "General";
        return cat === browseCategory && sub === browseSubcategory;
      })
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [browseCategory, browseSubcategory, dantesTopics]);

  const searchResults = useMemo(() => {
    const q = dantesQuery.trim().toLowerCase();
    if (!q) return [];
    return dantesTopics
      .filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          (t.description || "").toLowerCase().includes(q) ||
          (t.categoryName || "").toLowerCase().includes(q) ||
          (t.subcategoryName || "").toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q),
      )
      .slice(0, 48);
  }, [dantesQuery, dantesTopics]);

  const isSearching = dantesQuery.trim().length > 0;

  const selectedResources = useMemo(
    () => dantesResources.filter((r, i) => selectedResourceKeys.has(resourceKey(r, i))),
    [dantesResources, selectedResourceKeys],
  );

  function selectCategory(name: string) {
    setBrowseCategory(name);
    setBrowseSubcategory(null);
    setSelectedTopic(null);
    setDantesQuery("");
  }

  function selectSubcategory(name: string) {
    setBrowseSubcategory(name);
    setSelectedTopic(null);
  }

  function resetBrowseToCategories() {
    setBrowseCategory(null);
    setBrowseSubcategory(null);
    setSelectedTopic(null);
  }

  function resetBrowseToSubcategories() {
    setBrowseSubcategory(null);
    setSelectedTopic(null);
  }

  function pickTopic(topic: DantesTopic) {
    setSelectedTopic(topic);
    // Align breadcrumb with the topic’s path when picking from search
    setBrowseCategory((topic.categoryName || "Other").trim() || "Other");
    setBrowseSubcategory((topic.subcategoryName || "General").trim() || "General");
  }

  function toggleResource(key: string) {
    setSelectedResourceKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  function selectAllResources() {
    setSelectedResourceKeys(new Set(dantesResources.map((r, i) => resourceKey(r, i))));
  }

  function deselectAllResources() {
    setSelectedResourceKeys(new Set());
  }

  function selectMode(next: WorkspaceCreateMode) {
    setError("");
    if (!isUiWorkspaceCreateMode(next)) return;
    if (next === "blank") {
      // Blank starts creation immediately — no second confirmation step
      setMode("blank");
      void handleCreateBlank();
      return;
    }
    if (next === "knowledge_region") {
      setMode("knowledge_region");
      void handleCreateKnowledgeRegion();
      return;
    }
    setMode(next);
    setStep(2);
  }

  function backToModes() {
    setStep(1);
    setError("");
  }

  async function ensureAuthed(): Promise<boolean> {
    const { data } = await supabase.auth.getUser();
    if (!data.user) {
      router.push("/login?redirect=/workspace/new");
      return false;
    }
    return true;
  }

  async function handleCreateBlank() {
    if (busy) return;
    setBusy(true);
    setError("");
    let succeeded = false;
    try {
      if (!(await ensureAuthed())) return;
      const response = await fetch("/api/workspace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ createMode: "blank", topic: "Blank workspace" }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          errorMessageFromBody(payload, "Failed to create blank workspace"),
        );
      }
      const payload = await response.json();
      trackWorkspaceCreated({ hasFiles: false });
      router.push(`/workspace/${payload.workspaceId}`);
      succeeded = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(resolveWorkspaceCreateOverlay({ succeeded }).busy);
    }
  }

  async function handleCreateKnowledgeRegion() {
    if (busy) return;
    setBusy(true);
    setError("");
    let succeeded = false;
    try {
      if (!(await ensureAuthed())) return;
      const response = await fetch("/api/workspace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createMode: "knowledge_region",
          topic: "Knowledge Region",
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          errorMessageFromBody(payload, "Failed to create knowledge region workspace"),
        );
      }
      const payload = await response.json();
      trackWorkspaceCreated({ hasFiles: false });
      router.push(`/workspace/${payload.workspaceId}`);
      succeeded = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(resolveWorkspaceCreateOverlay({ succeeded }).busy);
    }
  }

  async function handleCreateTemplate() {
    if (!selectedTopic || busy) return;
    setBusy(true);
    setError("");
    let succeeded = false;
    try {
      if (!(await ensureAuthed())) return;
      const response = await fetch("/api/workspace/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          createMode: "template",
          topic: selectedTopic.name,
          days: 28,
          initialChapters,
          dantesTopic: {
            slug: selectedTopic.slug,
            name: selectedTopic.name,
            description: selectedTopic.description,
          },
          // Selected cards only — API persists them as workspace notes with links
          // and injects them into the initial generate prompt.
          dantesResources: selectedResources.map((r) => ({
            title: r.title,
            type: r.type,
            url: r.url,
            description: r.description,
            difficulty: r.difficulty,
          })),
        }),
      });
      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(
          errorMessageFromBody(payload, "Failed to create workspace from template"),
        );
      }
      const payload = await response.json();
      trackWorkspaceCreated({ hasFiles: false });
      router.push(`/workspace/${payload.workspaceId}`);
      succeeded = true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(resolveWorkspaceCreateOverlay({ succeeded }).busy);
    }
  }

  return (
    <main
      className="relative flex min-h-screen flex-col overflow-hidden bg-[#0a0a0a] text-zinc-200 selection:bg-zinc-700"
      style={
        bgImage
          ? { backgroundImage: `url(${bgImage})`, backgroundSize: "cover", backgroundPosition: "center" }
          : {}
      }
    >
      <div className="fixed inset-0 z-0 bg-[#0a0a0a]/76" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_72%_8%,rgba(14,116,144,0.16),transparent_32%)]" />
      <div
        className={`fixed inset-0 z-30 flex items-center justify-center transition-opacity duration-700 ${busy ? "opacity-100" : "pointer-events-none opacity-0"}`}
        aria-live="polite"
        aria-atomic="true"
      >
        <LoadingStatusMessage message="Creating workspace" />
      </div>

      <header
        className={`relative z-10 flex w-full items-center justify-between px-6 py-5 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <Link
          href="/"
          className="text-base font-semibold tracking-tight text-white transition hover:text-zinc-300"
        >
          Uncertain Systems
        </Link>
        {/* Login removed from workspace new screen by design */}
      </header>

      <section
        className={`relative z-10 flex flex-1 items-center justify-center px-6 py-12 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <div className="w-full max-w-[1080px]">
          <div className="mb-7 text-center">
            <div className="mb-5 inline-block rounded-none border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500">
              STEP {step} • {step === 1 ? "CHOOSE HOW TO START" : "CONFIGURE WORKSPACE"}
            </div>
            <h1 className="text-4xl font-medium leading-[1.05] tracking-[-2px] text-white sm:text-5xl">
              Create your Workspace.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-base leading-relaxed text-zinc-400 sm:text-lg">
              {step === 1
                ? "Pick how you want to start."
                : "Browse by category, pick a topic, then choose which resources to use as context."}
            </p>
          </div>

          {step === 1 && (
            <div
              className="mx-auto flex flex-col gap-3 md:gap-4"
              data-create-mode-cards
              data-create-layout="3-plus-1"
            >
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3 md:gap-4">
                <a
                  href={AYCL_CARD.href}
                  className={START_CARD_CLASS}
                  data-aycl-banner
                  data-create-mode="aycl"
                >
                  <span className="inline-block w-fit rounded-none border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    {AYCL_CARD.badge}
                  </span>
                  <h2 className="mt-4 text-xl font-medium tracking-tight text-white group-hover:text-zinc-50">
                    {AYCL_CARD.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                    {AYCL_CARD.description}
                  </p>
                  <ul className="mt-4 flex flex-1 flex-col gap-2 text-[13px] leading-snug text-zinc-400">
                    {AYCL_CARD.details.map((line) => (
                      <li key={line} className="border-l border-zinc-700 pl-2.5">
                        {line}
                      </li>
                    ))}
                  </ul>
                  <span className="mt-5 text-sm font-medium text-white">
                    {AYCL_CARD.cta} →
                  </span>
                </a>
                {PRIMARY_MODE_CARDS.map((card) => (
                  <button
                    key={card.mode}
                    type="button"
                    disabled={busy}
                    onClick={() => selectMode(card.mode)}
                    className={`${START_CARD_CLASS} disabled:cursor-not-allowed disabled:opacity-50`}
                    data-create-mode={card.mode}
                  >
                    <span className="inline-block w-fit rounded-none border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                      {card.badge}
                    </span>
                    <h2 className="mt-4 text-xl font-medium tracking-tight text-white group-hover:text-zinc-50">
                      {card.title}
                    </h2>
                    <p className="mt-2 text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                      {card.description}
                    </p>
                    <ul className="mt-4 flex flex-1 flex-col gap-2 text-[13px] leading-snug text-zinc-400">
                      {card.details.map((line) => (
                        <li key={line} className="border-l border-zinc-700 pl-2.5">
                          {line}
                        </li>
                      ))}
                    </ul>
                    <span className="mt-5 text-sm font-medium text-white">
                      {card.cta} →
                    </span>
                  </button>
                ))}
              </div>
              <button
                type="button"
                disabled={busy}
                onClick={() => selectMode("knowledge_region")}
                className={KR_SPAN_CARD_CLASS}
                data-create-mode="knowledge_region"
                data-create-mode-span="knowledge_region"
              >
                <div className="min-w-0 md:max-w-sm md:shrink-0">
                  <span className="inline-block w-fit rounded-none border border-zinc-700 px-2 py-0.5 font-mono text-[10px] uppercase tracking-[1.5px] text-zinc-500">
                    {KNOWLEDGE_REGION_CARD.badge}
                  </span>
                  <h2 className="mt-3 text-xl font-medium tracking-tight text-white group-hover:text-zinc-50">
                    {KNOWLEDGE_REGION_CARD.title}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-zinc-500 group-hover:text-zinc-400">
                    {KNOWLEDGE_REGION_CARD.description}
                  </p>
                </div>
                <ul className="mt-4 flex flex-1 flex-col gap-2 text-[13px] leading-snug text-zinc-400 md:mt-0 md:flex-row md:flex-wrap md:items-center md:gap-x-6 md:gap-y-2">
                  {KNOWLEDGE_REGION_CARD.details.map((line) => (
                    <li key={line} className="border-l border-zinc-700 pl-2.5">
                      {line}
                    </li>
                  ))}
                </ul>
                <span className="mt-4 shrink-0 text-sm font-medium text-white md:mt-0">
                  {KNOWLEDGE_REGION_CARD.cta} →
                </span>
              </button>
            </div>
          )}

          {step === 1 && error && (
            <p className="mt-4 text-center text-sm text-red-300">{error}</p>
          )}

          {step === 2 && mode === "template" && (
            <div className="rounded-none border border-zinc-800 bg-zinc-950/90 p-4 sm:p-6">
              <div className="mb-4 flex items-center justify-between gap-2">
                <h2 className="text-lg font-medium text-white">From Template</h2>
                <button
                  type="button"
                  onClick={backToModes}
                  className="text-sm text-zinc-500 hover:text-white"
                >
                  ← Back
                </button>
              </div>

              {/* Hierarchical browse: Category → Subcategory → Topic */}
              <nav
                className="mb-3 flex flex-wrap items-center gap-1 text-[11px] text-zinc-500"
                aria-label="Topic path"
              >
                <button
                  type="button"
                  onClick={resetBrowseToCategories}
                  className={`rounded-none px-1.5 py-0.5 transition hover:text-white ${
                    !browseCategory ? "text-white" : "text-zinc-400"
                  }`}
                >
                  Categories
                </button>
                {browseCategory && (
                  <>
                    <span className="text-zinc-700">/</span>
                    <button
                      type="button"
                      onClick={resetBrowseToSubcategories}
                      className={`rounded-none px-1.5 py-0.5 transition hover:text-white ${
                        browseCategory && !browseSubcategory ? "text-white" : "text-zinc-400"
                      }`}
                    >
                      {browseCategory}
                    </button>
                  </>
                )}
                {browseSubcategory && (
                  <>
                    <span className="text-zinc-700">/</span>
                    <span className="rounded-none px-1.5 py-0.5 text-white">{browseSubcategory}</span>
                  </>
                )}
              </nav>

              <input
                value={dantesQuery}
                onChange={(e) => setDantesQuery(e.target.value)}
                placeholder="Search all topics..."
                className="mb-3 w-full rounded-none border border-zinc-800 bg-zinc-900/80 px-3 py-2 text-sm text-white outline-none focus:border-zinc-500"
              />

              <div className="grid max-h-[300px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2">
                {dantesLoading ? (
                  <p className="col-span-full py-8 text-center text-sm text-zinc-500">Loading topics…</p>
                ) : isSearching ? (
                  searchResults.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-sm text-zinc-500">No topics found.</p>
                  ) : (
                    searchResults.map((topic) => (
                      <button
                        key={topic.slug}
                        type="button"
                        onClick={() => pickTopic(topic)}
                        className={`rounded-none border p-3 text-left transition ${
                          selectedTopic?.slug === topic.slug
                            ? "border-white/50 bg-white/10 ring-1 ring-white/20"
                            : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                        }`}
                      >
                        <span className="block text-sm font-medium text-zinc-100">{topic.name}</span>
                        <span className="mt-1 block text-[11px] text-zinc-500">
                          {(topic.categoryName || "Other").trim()}
                          {topic.subcategoryName ? ` / ${topic.subcategoryName}` : ""}
                          {totalTopicResources(topic) > 0
                            ? ` · ${totalTopicResources(topic)} resources`
                            : ""}
                        </span>
                      </button>
                    ))
                  )
                ) : !browseCategory ? (
                  categories.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-sm text-zinc-500">No categories available.</p>
                  ) : (
                    categories.map((cat) => (
                      <button
                        key={cat.name}
                        type="button"
                        onClick={() => selectCategory(cat.name)}
                        className="rounded-none border border-zinc-800 bg-zinc-900/50 p-3 text-left transition hover:border-zinc-500 hover:bg-zinc-900"
                      >
                        <span className="block text-sm font-medium text-zinc-100">{cat.name}</span>
                        <span className="mt-1 block text-[11px] text-zinc-500">
                          {cat.count} topic{cat.count === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))
                  )
                ) : !browseSubcategory ? (
                  subcategories.length === 0 ? (
                    <p className="col-span-full py-8 text-center text-sm text-zinc-500">No subcategories.</p>
                  ) : (
                    subcategories.map((sub) => (
                      <button
                        key={sub.name}
                        type="button"
                        onClick={() => selectSubcategory(sub.name)}
                        className="rounded-none border border-zinc-800 bg-zinc-900/50 p-3 text-left transition hover:border-zinc-500 hover:bg-zinc-900"
                      >
                        <span className="block text-sm font-medium text-zinc-100">{sub.name}</span>
                        <span className="mt-1 block text-[11px] text-zinc-500">
                          {sub.count} topic{sub.count === 1 ? "" : "s"}
                        </span>
                      </button>
                    ))
                  )
                ) : topicsInBrowse.length === 0 ? (
                  <p className="col-span-full py-8 text-center text-sm text-zinc-500">No topics here.</p>
                ) : (
                  topicsInBrowse.map((topic) => (
                    <button
                      key={topic.slug}
                      type="button"
                      onClick={() => pickTopic(topic)}
                      className={`rounded-none border p-3 text-left transition ${
                        selectedTopic?.slug === topic.slug
                          ? "border-white/50 bg-white/10 ring-1 ring-white/20"
                          : "border-zinc-800 bg-zinc-900/50 hover:border-zinc-600"
                      }`}
                    >
                      <span className="block text-sm font-medium text-zinc-100">{topic.name}</span>
                      {topic.description && (
                        <span className="mt-1 line-clamp-2 block text-[11px] leading-snug text-zinc-500">
                          {topic.description}
                        </span>
                      )}
                      {totalTopicResources(topic) > 0 && (
                        <span className="mt-1.5 block text-[10px] text-zinc-600">
                          {totalTopicResources(topic)} resources
                        </span>
                      )}
                    </button>
                  ))
                )}
              </div>

              {/* Resource context cards — toggle which ones to include */}
              {selectedTopic && (
                <div className="mt-5 border-t border-zinc-800 pt-4">
                  <div className="mb-2 flex flex-wrap items-end justify-between gap-2">
                    <div>
                      <p className="font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
                        Context resources
                      </p>
                      <p className="mt-1 text-sm text-zinc-300">
                        {selectedTopic.name}
                        {!resourcesLoading && dantesResources.length > 0 && (
                          <span className="text-zinc-500">
                            {" "}
                            · {selectedResourceKeys.size} of {dantesResources.length} selected
                          </span>
                        )}
                      </p>
                    </div>
                    {dantesResources.length > 0 && (
                      <div className="flex gap-2 text-[11px]">
                        <button
                          type="button"
                          onClick={selectAllResources}
                          disabled={busy}
                          className="text-zinc-400 hover:text-white disabled:opacity-40"
                        >
                          Select all
                        </button>
                        <span className="text-zinc-700">·</span>
                        <button
                          type="button"
                          onClick={deselectAllResources}
                          disabled={busy}
                          className="text-zinc-400 hover:text-white disabled:opacity-40"
                        >
                          Deselect all
                        </button>
                      </div>
                    )}
                  </div>
                  <p className="mb-3 text-xs text-zinc-500">
                    Click a card to include or exclude it from generation context.
                  </p>

                  {resourcesLoading ? (
                    <p className="py-6 text-center text-sm text-zinc-500">Loading resources…</p>
                  ) : dantesResources.length === 0 ? (
                    <p className="rounded-none border border-zinc-800 bg-zinc-900/40 px-3 py-4 text-center text-sm text-zinc-500">
                      No curated resources for this topic — generation will use the topic name only.
                    </p>
                  ) : (
                    <div className="grid max-h-[240px] grid-cols-1 gap-2 overflow-y-auto sm:grid-cols-2 lg:grid-cols-3">
                      {dantesResources.map((resource, index) => {
                        const key = resourceKey(resource, index);
                        const included = selectedResourceKeys.has(key);
                        return (
                          <button
                            key={key}
                            type="button"
                            onClick={() => toggleResource(key)}
                            disabled={busy}
                            className={`rounded-none border p-2.5 text-left transition disabled:opacity-50 ${
                              included
                                ? "border-white/40 bg-white/10 ring-1 ring-white/15"
                                : "border-zinc-800 bg-zinc-950/60 opacity-55 hover:opacity-80"
                            }`}
                            aria-pressed={included}
                          >
                            <div className="flex gap-2">
                              {resource.image ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img
                                  src={resource.image}
                                  alt=""
                                  className="h-11 w-11 shrink-0 rounded-none object-cover"
                                />
                              ) : (
                                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-none border border-zinc-800 bg-zinc-900 text-[10px] font-medium uppercase text-zinc-500">
                                  {(resource.type || "?").slice(0, 3)}
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-1">
                                  <span className="line-clamp-2 text-xs font-medium leading-snug text-zinc-100">
                                    {resource.title}
                                  </span>
                                  <span
                                    className={`mt-0.5 shrink-0 text-[10px] ${
                                      included ? "text-white" : "text-zinc-600"
                                    }`}
                                  >
                                    {included ? "✓" : "○"}
                                  </span>
                                </div>
                                <span className="mt-1 block text-[10px] text-zinc-500">
                                  {RESOURCE_TYPE_LABELS[resource.type] || resource.type}
                                  {resource.difficulty ? ` · ${resource.difficulty}` : ""}
                                </span>
                                {(resource.author || resource.provider) && (
                                  <span className="mt-0.5 line-clamp-1 block text-[10px] text-zinc-600">
                                    {[resource.author, resource.provider].filter(Boolean).join(" · ")}
                                  </span>
                                )}
                              </div>
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              <StartingSizePicker
                initialChapters={initialChapters}
                onChange={setInitialChapters}
                busy={busy}
              />

              {error && <p className="mt-3 text-sm text-red-300">{error}</p>}

              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  disabled={!selectedTopic || busy}
                  onClick={() => void handleCreateTemplate()}
                  className="rounded-none bg-white px-5 py-2.5 text-sm font-medium text-black hover:bg-zinc-200 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  {busy ? "Creating..." : "Create from template →"}
                </button>
              </div>
            </div>
          )}

        </div>
      </section>

      <div
        className={`relative z-10 transition-opacity duration-700 ${busy ? "pointer-events-none opacity-0" : "opacity-100"}`}
      >
        <Footer />
      </div>
    </main>
  );
}

function StartingSizePicker({
  initialChapters,
  onChange,
  busy,
}: {
  initialChapters: InitialChaptersLevel;
  onChange: (level: InitialChaptersLevel) => void;
  busy: boolean;
}) {
  const band = getInitialChaptersBand(initialChapters);
  return (
    <div className="mt-4 w-full">
      <div className="mb-2 flex items-end justify-between gap-3">
        <label className="block font-mono text-[10px] uppercase tracking-[2px] text-zinc-500">
          Map type
        </label>
        <span className="text-[11px] text-zinc-600">
          About {band.target} blocks ({band.min}–{band.max})
        </span>
      </div>
      <InitialChaptersPicker
        value={initialChapters}
        onChange={onChange}
        disabled={busy}
        t={startingSizeCopy}
        i18nPrefix="session"
      />
    </div>
  );
}
