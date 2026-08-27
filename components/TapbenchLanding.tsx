"use client";

import { useEffect, useState } from "react";
import { TapbenchShell } from "@/components/TapbenchShell";
import { TapbenchResultsTable } from "@/components/TapbenchResultsTable";
import { TapbenchResultsIntro } from "@/components/TapbenchResultsIntro";
import { TapbenchExperimentTutorial } from "@/components/TapbenchExperimentTutorial";
import { TAPBENCH_API_BASE } from "@/lib/tapbench/constants";
import type { TapbenchTask } from "@/lib/tapbench/catalog";
import type { TapbenchPublicRegion } from "@/lib/tapbench/region";
import {
  loadStoredTapbenchKeys,
  mergeIssuedKeys,
  saveStoredTapbenchKeys,
  type StoredTapbenchKeys,
} from "@/lib/tapbench/key-storage";
import {
  TAPBENCH_WRAP_SKILL_FILENAME,
  downloadMarkdownFile,
} from "@/lib/tapbench/skill-md";
import { parseJsonResponse } from "@/lib/tapbench/parse-json-response";

type IssuedKey = { workspace_id: string; tapbench_key: string; task_title: string };

type TapbenchTab = "tapbench" | "results" | "experiment";

const TABS: { id: TapbenchTab; label: string }[] = [
  { id: "tapbench", label: "TAPBench" },
  { id: "results", label: "ScoreBoard" },
  { id: "experiment", label: "How to run" },
];

export function TapbenchLanding(props: {
  initialTasks: TapbenchTask[];
  initialRegions?: TapbenchPublicRegion[];
}) {
  const [tasks, setTasks] = useState(props.initialTasks);
  const [regions, setRegions] = useState(props.initialRegions ?? []);
  const [keys, setKeys] = useState<StoredTapbenchKeys>({});
  const [busyId, setBusyId] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [tab, setTab] = useState<TapbenchTab>("tapbench");

  useEffect(() => {
    setKeys(loadStoredTapbenchKeys());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const hash = window.location.hash.replace(/^#/, "");
    if (hash === "scoreboard" || hash === "results") setTab("results");
    else if (hash === "howto" || hash === "how-to" || hash === "how-to-run" || hash === "experiment") {
      setTab("experiment");
    } else if (hash === "tapbench") setTab("tapbench");
  }, []);

  const selectTab = (next: TapbenchTab) => {
    setTab(next);
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.hash = next === "results" ? "scoreboard" : next === "experiment" ? "howto" : next;
    window.history.replaceState(null, "", url.toString());
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [taskRes, resultRes] = await Promise.all([
          fetch(`${TAPBENCH_API_BASE}/tasks`),
          fetch(`${TAPBENCH_API_BASE}/results`),
        ]);
        if (taskRes.ok) {
          const body = (await taskRes.json()) as { tasks?: TapbenchTask[] };
          if (!cancelled && Array.isArray(body.tasks)) setTasks(body.tasks);
        }
        if (resultRes.ok) {
          const body = (await resultRes.json()) as {
            regions?: TapbenchPublicRegion[];
          };
          if (!cancelled && Array.isArray(body.regions)) setRegions(body.regions);
        }
      } catch {
        /* empty catalog is valid */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const persistIssued = (rows: IssuedKey[]) => {
    const next = mergeIssuedKeys(keys, rows);
    setKeys(next);
    saveStoredTapbenchKeys(next);
  };

  const getKey = async (workspaceId: string) => {
    setStatus("");
    setBusyId(workspaceId);
    try {
      const res = await fetch(`${TAPBENCH_API_BASE}/keys`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspace_ids: [workspaceId], label: "TAPBench key" }),
      });
      const body = await parseJsonResponse<{
        keys?: IssuedKey[];
        error?: { message?: string };
      }>(res);
      if (!res.ok || !Array.isArray(body.keys)) {
        setStatus(body.error?.message || "Key request failed.");
        return;
      }
      persistIssued(body.keys);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Key request failed.");
    } finally {
      setBusyId(null);
    }
  };

  const downloadSkill = async (workspaceId: string) => {
    setStatus("");
    setBusyId(workspaceId);
    try {
      const res = await fetch(`${TAPBENCH_API_BASE}/skill`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_ids: [workspaceId],
          origin: window.location.origin,
        }),
      });
      const body = await parseJsonResponse<{
        markdown?: string;
        filename?: string;
        keys?: IssuedKey[];
        error?: { message?: string };
      }>(res);
      if (!res.ok || typeof body.markdown !== "string") {
        setStatus(body.error?.message || "Skill request failed.");
        return;
      }
      if (Array.isArray(body.keys)) persistIssued(body.keys);
      downloadMarkdownFile(body.markdown, body.filename || TAPBENCH_WRAP_SKILL_FILENAME);
    } catch (err) {
      setStatus(err instanceof Error ? err.message : "Skill request failed.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <TapbenchShell landing>
      <header data-tapbench-landing-hero>
        <div
          className="mb-4 inline-block rounded-sm border border-zinc-800 bg-zinc-950/80 px-3 py-1 font-mono text-[10px] tracking-[2px] text-zinc-500"
          data-tapbench-landing-kicker
        >
          TAPBENCH
        </div>
        <h1 className="text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">TAPBench</h1>
        <p className="mt-2 text-sm text-zinc-400 sm:text-base">
          TAP-Bench: Think-Aloud Protocol + Benchmark. An instrument for measuring knowledge
          in configuration space.
        </p>
      </header>

      <div
        className="mt-8 flex w-full gap-1 border-b border-zinc-800"
        data-tapbench-tabs
        role="tablist"
        aria-label="TAPBench"
      >
        {TABS.map((item) => (
          <button
            key={item.id}
            type="button"
            role="tab"
            aria-selected={tab === item.id}
            className={`px-3 py-2 text-xs uppercase tracking-wide ${
              tab === item.id
                ? "border-b border-white text-white"
                : "text-zinc-500 hover:text-zinc-300"
            }`}
            onClick={() => selectTab(item.id)}
            data-tapbench-tab={item.id}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === "tapbench" ? (
        <section className="mt-8 w-full" data-tapbench-landing-about role="tabpanel" id="tapbench">
          <TapbenchResultsIntro />
        </section>
      ) : null}
      {tab === "results" ? (
        <section
          className="mt-8 w-full"
          data-tapbench-landing-results
          id="results"
          role="tabpanel"
        >
          <TapbenchResultsTable
            tasks={tasks}
            regions={regions}
            busyId={busyId}
            empty="None"
            onIssueKey={(id) => void getKey(id)}
            onDownloadSkill={(id) => void downloadSkill(id)}
          />
          {status ? (
            <p className="mt-3 text-xs text-zinc-400" data-tapbench-key-status>
              {status}
            </p>
          ) : null}
        </section>
      ) : null}
      {tab === "experiment" ? (
        <div className="mt-8 w-full" role="tabpanel" id="experiment">
          <TapbenchExperimentTutorial />
        </div>
      ) : null}
    </TapbenchShell>
  );
}
