"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { errorMessageFromBody } from "@/lib/api-error-envelope";
import {
  PRACTICE_CATALOG_PATH,
  PRACTICE_START_PATH,
  groupPracticeProblems,
  type PracticeCategoryGroup,
  type PracticeProblem,
} from "@/lib/practice-problems";
import { freeWeeklySessionLimitMessage } from "@/lib/free-tier";

export function DashboardPracticeTab({
  weeklySessionsAllowed = true,
}: {
  weeklySessionsAllowed?: boolean;
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<PracticeCategoryGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("all");
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

  const categories = useMemo(
    () => groups.map((group) => group.category),
    [groups],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .filter((group) => category === "all" || group.category === category)
      .map((group) => ({
        ...group,
        subcategories: group.subcategories
          .map((sub) => ({
            ...sub,
            problems: sub.problems.filter((problem) => {
              if (!q) return true;
              const hay = `${problem.title} ${problem.prompt} ${problem.subcategory}`.toLowerCase();
              return hay.includes(q);
            }),
          }))
          .filter((sub) => sub.problems.length > 0),
      }))
      .filter((group) => group.subcategories.length > 0);
  }, [groups, query, category]);

  async function startProblem(problem: PracticeProblem) {
    if (busyId) return;
    setBusyId(problem.id);
    setError("");
    try {
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
      const response = await fetch(PRACTICE_START_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ problemId: problem.id }),
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

  return (
    <div className="space-y-6" data-dashboard-practice>
      <header className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            Learning
          </p>
          <h2 className="mt-1 text-2xl font-medium tracking-[-0.6px] text-white">
            Practice library
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-neutral-400">
            Pick a problem and start a Solve session. Each run is yours — no verification or calibration.
          </p>
        </div>
      </header>

      <section className="console-copy px-4 py-3" data-dashboard-practice-search>
        <div className="flex flex-col gap-2 sm:flex-row">
          <label className="block min-w-0 flex-1">
            <span className="sr-only">Search exercises</span>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search exercises"
              className="w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/80 focus:outline-none"
            />
          </label>
          <label className="block sm:w-64">
            <span className="sr-only">Category</span>
            <select
              value={category}
              onChange={(event) => setCategory(event.target.value)}
              className="w-full rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white focus:border-white/80 focus:outline-none"
            >
              <option value="all">All categories</option>
              {categories.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
            </select>
          </label>
        </div>
        {error ? <p className="mt-2 text-sm text-red-300">{error}</p> : null}
        {!weeklySessionsAllowed ? (
          <p className="mt-2 text-xs text-neutral-500">
            {freeWeeklySessionLimitMessage(new Date())}
          </p>
        ) : null}
      </section>

      {loading ? (
        <p className="text-sm text-neutral-500">Loading exercises…</p>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-neutral-500">No exercises match that search.</p>
      ) : (
        filtered.map((group) => (
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
                <ul className="grid gap-2">
                  {sub.problems.map((problem) => (
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
                        <button
                          type="button"
                          data-dashboard-practice-start={problem.id}
                          disabled={Boolean(busyId)}
                          onClick={() => void startProblem(problem)}
                          className="inline-flex h-9 shrink-0 items-center justify-center bg-white px-4 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
                        >
                          {busyId === problem.id ? "Starting…" : "Practice"}
                        </button>
                      </article>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        ))
      )}
    </div>
  );
}
