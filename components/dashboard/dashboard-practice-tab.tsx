"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import { dashboardPracticeCreateFlowCtas } from "@/lib/dashboard-nav";
import {
  PRACTICE_CATALOG_PATH,
  PRACTICE_START_KINDS,
  PRACTICE_START_PATH,
  countPracticeProblems,
  filterPracticeCatalog,
  groupPracticeProblems,
  practiceBrowseLevel,
  type PracticeCategoryGroup,
  type PracticeProblem,
  type PracticeStartKind,
} from "@/lib/practice-problems";
import { freeWeeklySessionLimitMessage } from "@/lib/free-tier";

function countLabel(n: number, singular: string, plural: string): string {
  return `${n} ${n === 1 ? singular : plural}`;
}

export function DashboardPracticeTab({
  weeklySessionsAllowed = true,
}: {
  weeklySessionsAllowed?: boolean;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<PracticeCategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [subcategory, setSubcategory] = useState<string | null>(null);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/dashboard/practice/catalog" satisfies typeof PRACTICE_CATALOG_PATH)
      .then((res) => res.json())
      .then((payload) => {
        if (cancelled) return;
        const next = Array.isArray(payload?.groups)
          ? payload.groups
          : groupPracticeProblems(Array.isArray(payload?.problems) ? payload.problems : []);
        setGroups(next);
      })
      .catch(() => {
        if (!cancelled) setGroups([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searching = query.trim().length > 0;
  const level = practiceBrowseLevel({ category, subcategory });
  const filtered = useMemo(
    () =>
      filterPracticeCatalog(groups, {
        query,
        category,
        subcategory: searching || level === "problems" ? subcategory : null,
      }),
    [groups, query, category, subcategory, searching, level],
  );

  const categoryGroup = filtered.find((group) => group.category === category) || null;
  const subcategoryGroup =
    categoryGroup?.subcategories.find((sub) => sub.subcategory === subcategory) || null;

  async function startProblem(problem: PracticeProblem, kind: PracticeStartKind) {
    if (busyId) return;
    setBusyId(`${problem.id}:${kind}`);
    setError("");
    try {
      if (kind === "solve") {
        const usageRes = await fetch("/api/check-usage");
        if (usageRes.ok) {
          const usage = await usageRes.json();
          const freeAccount = usage.freeTier === true || usage.hasPaidAccess === false;
          if (freeAccount && usage.weeklySessionsAllowed === false) {
            throw new Error(freeWeeklySessionLimitMessage(usage.weeklySessionsResetAt || new Date()));
          }
          if (!freeAccount && usage.allowed === false) {
            throw new Error("Session limit reached");
          }
        }
      }
      const response = await fetch(PRACTICE_START_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id, kind }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.href) {
        throw new Error(errorMessageFromBody(payload, "Could not start practice"));
      }
      router.push(String(payload.href));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start practice");
    } finally {
      setBusyId("");
    }
  }

  function openCategory(name: string) {
    setCategory(name);
    setSubcategory(null);
  }

  function openSubcategory(name: string) {
    setSubcategory(name);
  }

  function showCategories() {
    setCategory(null);
    setSubcategory(null);
  }

  function showSubcategories() {
    setSubcategory(null);
  }

  const browseMode = searching ? "search" : level;
  const emptyCopy = searching
    ? "No problems match that search."
    : groups.length === 0
      ? "No problems yet."
      : "No problems in this topic.";
  const createCtas = dashboardPracticeCreateFlowCtas();

  return (
    <div className="space-y-6" data-dashboard-practice>
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            Browse Problems
          </p>
          <h2 className="mt-1 text-2xl font-medium tracking-[-0.6px] text-white">
            Problems
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Choose a category, then a topic, then open a problem as Solve / Practice, Verify,
            or Calibrate.
          </p>
        </div>
        <div className="flex min-w-0 flex-col gap-2" data-dashboard-practice-create>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            Create your own
          </p>
          <p className="text-sm text-neutral-400">Practice, Verify, and Solve flows.</p>
          <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
            {createCtas.map((cta) => (
              <Link
                key={cta.id}
                href={cta.href}
                data-dashboard-practice-create-kind={cta.id}
                className={
                  cta.id === "solve"
                    ? "inline-flex h-9 items-center justify-center bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200"
                    : "console-button inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-white transition hover:border-white/80"
                }
              >
                {cta.label}
              </Link>
            ))}
          </div>
        </div>
      </header>

      <section className="console-copy px-4 py-3" data-dashboard-practice-search>
        <label className="block min-w-0">
          <span className="sr-only">Search problems</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search problems"
            className="w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/80 focus:outline-none"
          />
        </label>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        {!weeklySessionsAllowed ? (
          <p className="mt-2 text-xs text-neutral-500">
            {freeWeeklySessionLimitMessage(new Date())}
          </p>
        ) : null}
      </section>

      <nav
        className="flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500"
        data-dashboard-practice-crumbs
        aria-label="Practice catalog"
      >
        <button
          type="button"
          data-dashboard-practice-crumb="root"
          onClick={showCategories}
          className={
            category || searching
              ? "text-neutral-400 transition hover:text-white"
              : "text-white"
          }
        >
          Categories
        </button>
        {category ? (
          <>
            <span aria-hidden>/</span>
            <button
              type="button"
              data-dashboard-practice-crumb="category"
              onClick={showSubcategories}
              className={
                subcategory || searching
                  ? "text-neutral-400 transition hover:text-white"
                  : "text-white"
              }
            >
              {category}
            </button>
          </>
        ) : null}
        {category && subcategory ? (
          <>
            <span aria-hidden>/</span>
            <span data-dashboard-practice-crumb="subcategory" className="text-white">
              {subcategory}
            </span>
          </>
        ) : null}
        {searching ? (
          <>
            <span aria-hidden>/</span>
            <span data-dashboard-practice-crumb="search" className="text-white">
              Search
            </span>
          </>
        ) : null}
      </nav>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading problems…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">{emptyCopy}</p>
      ) : browseMode === "categories" ? (
        <ul
          className="grid gap-2 sm:grid-cols-2"
          data-dashboard-practice-browse="categories"
        >
          {filtered.map((group) => {
            const problems = countPracticeProblems(group);
            return (
              <li key={group.category}>
                <button
                  type="button"
                  data-dashboard-practice-open-category={group.category}
                  onClick={() => openCategory(group.category)}
                  className="console-copy flex h-full w-full flex-col items-start gap-2 px-4 py-4 text-left transition hover:border-white/80"
                >
                  <h3 className="text-base font-medium tracking-[-0.3px] text-white">
                    {group.category}
                  </h3>
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {countLabel(group.subcategories.length, "topic", "topics")} ·{" "}
                    {countLabel(problems, "problem", "problems")}
                  </p>
                </button>
              </li>
            );
          })}
        </ul>
      ) : browseMode === "subcategories" && categoryGroup ? (
        <ul
          className="grid gap-2 sm:grid-cols-2"
          data-dashboard-practice-browse="subcategories"
          data-dashboard-practice-category={categoryGroup.category}
        >
          {categoryGroup.subcategories.map((sub) => (
            <li key={sub.subcategory}>
              <button
                type="button"
                data-dashboard-practice-open-subcategory={sub.subcategory}
                onClick={() => openSubcategory(sub.subcategory)}
                className="console-copy flex h-full w-full flex-col items-start gap-2 px-4 py-4 text-left transition hover:border-white/80"
              >
                <h3 className="text-base font-medium tracking-[-0.3px] text-white">
                  {sub.subcategory}
                </h3>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                  {countLabel(sub.problems.length, "problem", "problems")}
                </p>
              </button>
            </li>
          ))}
        </ul>
      ) : browseMode === "problems" && subcategoryGroup && categoryGroup ? (
        <section
          className="space-y-2"
          data-dashboard-practice-browse="problems"
          data-dashboard-practice-category={categoryGroup.category}
        >
          <ProblemList
            problems={subcategoryGroup.problems}
            busyId={busyId}
            onStart={startProblem}
          />
        </section>
      ) : (
        <div className="space-y-6" data-dashboard-practice-browse="search">
          {filtered.map((group) => (
            <section
              key={group.category}
              className="space-y-4"
              data-dashboard-practice-category={group.category}
            >
              <h3 className="text-lg font-medium tracking-[-0.4px] text-white">
                {group.category}
              </h3>
              {group.subcategories.map((sub) => (
                <div key={sub.subcategory} className="space-y-2">
                  <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-neutral-500">
                    {sub.subcategory}
                  </p>
                  <ProblemList
                    problems={sub.problems}
                    busyId={busyId}
                    onStart={startProblem}
                  />
                </div>
              ))}
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

const PRACTICE_ACTION_LABELS: Record<PracticeStartKind, string> = {
  solve: "Solve / Practice",
  verification: "Verify",
  calibration: "Calibrate",
};

function ProblemList({
  problems,
  busyId,
  onStart,
}: {
  problems: PracticeProblem[];
  busyId: string;
  onStart: (problem: PracticeProblem, kind: PracticeStartKind) => void;
}) {
  return (
    <ul className="grid gap-2">
      {problems.map((problem) => (
        <li key={problem.id}>
          <article
            className="console-copy flex flex-col gap-3 px-4 py-4 sm:flex-row sm:items-start sm:justify-between"
            data-dashboard-practice-problem={problem.slug}
          >
            <div className="min-w-0">
              <h4 className="text-sm font-medium text-white">{problem.title}</h4>
              <p className="mt-1 text-sm leading-relaxed text-neutral-400">
                {problem.prompt}
              </p>
            </div>
            <div className="flex shrink-0 flex-col gap-2 sm:items-stretch">
              {PRACTICE_START_KINDS.map((kind) => {
                const busyKey = `${problem.id}:${kind}`;
                return (
                  <button
                    key={kind}
                    type="button"
                    data-dashboard-practice-start={kind === "solve" ? problem.id : undefined}
                    data-dashboard-practice-kind={kind}
                    disabled={Boolean(busyId)}
                    onClick={() => onStart(problem, kind)}
                    className={
                      kind === "solve"
                        ? "inline-flex h-9 items-center justify-center bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
                        : "console-button inline-flex h-9 items-center justify-center px-4 text-sm font-medium text-white transition hover:border-white/80 disabled:opacity-40"
                    }
                  >
                    {busyId === busyKey
                      ? kind === "solve"
                        ? "Starting…"
                        : "Creating…"
                      : PRACTICE_ACTION_LABELS[kind]}
                  </button>
                );
              })}
            </div>
          </article>
        </li>
      ))}
    </ul>
  );
}
