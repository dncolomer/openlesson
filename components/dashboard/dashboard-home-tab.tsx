"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { Workspace } from "@/lib/storage";
import { dashboardHasNoWorkspaces } from "@/lib/dashboard-workspace-filters";
import {
  DASHBOARD_PLAY_KINDS,
  DASHBOARD_PLAY_START_PATH,
  dashboardPlayKindLabel,
  normalizeDashboardPlayPrompt,
  type DashboardPlayKind,
} from "@/lib/dashboard-play";
import { errorMessageFromBody } from "@/lib/api-error-envelope";

export type DashboardHomeTabProps = {
  workspaces: Workspace[];
  t: (key: string, params?: Record<string, string | number>) => string;
};

export function DashboardHomeTab({
  workspaces,
  t,
}: DashboardHomeTabProps) {
  const router = useRouter();
  const [kind, setKind] = useState<DashboardPlayKind>("learn");
  const [prompt, setPrompt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const emptyWorkspaces = dashboardHasNoWorkspaces(workspaces);
  const canStart = useMemo(() => Boolean(normalizeDashboardPlayPrompt(prompt)), [prompt]);

  async function startPlay() {
    const trimmed = normalizeDashboardPlayPrompt(prompt);
    if (!trimmed || busy) return;
    setBusy(true);
    setError("");
    try {
      const usageRes = await fetch("/api/check-usage");
      if (usageRes.ok) {
        const usage = await usageRes.json();
        if (usage.allowed === false) {
          setError(t("problemInput.sessionLimitReached"));
          return;
        }
      }
      const response = await fetch(DASHBOARD_PLAY_START_PATH, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, prompt: trimmed }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.href) {
        throw new Error(errorMessageFromBody(payload, "Could not start session"));
      }
      router.push(String(payload.href));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not start session");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6" data-dashboard-home>
      <section className="console-copy px-6 py-7 sm:px-8 sm:py-8" data-dashboard-play>
        <p className="mb-3 font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
          Play
        </p>
        <h2 className="max-w-2xl text-3xl font-medium tracking-[-1.2px] text-white sm:text-4xl">
          Quick Work Session
        </h2>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-neutral-400">
          A prompt is enough. These runs are disposable — they are not attached to a workspace
          and they are not kept.
        </p>

        <div className="mt-6 flex flex-wrap gap-2" data-dashboard-play-kinds>
          {DASHBOARD_PLAY_KINDS.map((item) => {
            const active = kind === item;
            return (
              <button
                key={item}
                type="button"
                data-dashboard-play-kind={item}
                data-dashboard-play-kind-active={active ? "true" : "false"}
                onClick={() => setKind(item)}
                className={`rounded-none border px-3 py-1.5 text-xs font-medium transition ${
                  active
                    ? "border-white/80 bg-white text-black"
                    : "border-white/40 text-white hover:border-white/80"
                }`}
              >
                {dashboardPlayKindLabel(item)}
              </button>
            );
          })}
        </div>

        <form
          className="mt-5 space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void startPlay();
          }}
        >
          <label className="block">
            <span className="sr-only">Prompt</span>
            <textarea
              data-dashboard-play-prompt
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              rows={3}
              placeholder="A topic, a question, or a skill you want to try."
              className="w-full resize-y rounded-none border border-white/40 bg-black px-3 py-2 text-sm text-white placeholder:text-neutral-600 focus:border-white/80 focus:outline-none"
            />
          </label>
          {error ? <p className="text-sm text-red-300">{error}</p> : null}
          <button
            type="submit"
            data-dashboard-play-start
            disabled={!canStart || busy}
            className="inline-flex h-11 min-w-[180px] items-center justify-center rounded-none bg-white px-6 text-sm font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40"
          >
            {busy ? "Starting…" : `Start ${dashboardPlayKindLabel(kind)}`}
          </button>
        </form>
      </section>

      {emptyWorkspaces ? (
        <section
          data-dashboard-empty-workspaces
          className="console-copy px-6 py-8 sm:px-8"
        >
          <p className="font-mono text-[10px] uppercase tracking-[2px] text-neutral-500">
            {t("dashboard.emptyWorkspacesKicker")}
          </p>
          <h3 className="mt-2 text-xl font-medium tracking-[-0.6px] text-white">
            {t("dashboard.emptyWorkspacesTitle")}
          </h3>
          <p className="mt-2 max-w-xl text-sm text-neutral-400">{t("dashboard.emptyWorkspacesBody")}</p>
          <Link
            href="/workspace/new"
            data-dashboard-empty-create
            className="mt-5 inline-flex h-10 items-center justify-center rounded-none border border-white/40 px-5 text-sm text-white transition hover:border-white/80"
          >
            {t("dashboard.emptyWorkspacesCta")}
          </Link>
        </section>
      ) : null}
    </div>
  );
}
