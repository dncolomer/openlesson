"use client";

/**
 * TAPBench link mint + list for Settings Knowledge Links.
 * Creates timed agent exercises (Stash/Submit) with always-visible share URLs.
 */

import { useCallback, useEffect, useState } from "react";
import {
  buildTapbenchSkillsMarkdown,
  downloadTapbenchSkillsMarkdown,
  TAPBENCH_SKILLS_MD_FILENAME,
} from "@/lib/pow-api/tapbench-skills-md";

export interface TapbenchLinkRow {
  id: string;
  workspace_id: string;
  block_id: string | null;
  status: string;
  exercise: string;
  duration_seconds: number;
  expires_at: string;
  remaining_ms: number;
  created_at: string;
  public_token: string;
  url: string;
  guest_user_id?: string | null;
}

const PRIMARY_CTA_CLASS =
  "rounded-lg bg-white px-3 py-2 text-xs font-medium text-black transition hover:bg-neutral-200 disabled:opacity-40";

interface WorkspaceTapbenchLinksPanelProps {
  workspaceId: string;
  ayclToken?: string;
}

export function WorkspaceTapbenchLinksPanel({
  workspaceId,
  ayclToken,
}: WorkspaceTapbenchLinksPanelProps) {
  const [tapbenchLinks, setTapbenchLinks] = useState<TapbenchLinkRow[]>([]);
  const [blocks, setBlocks] = useState<Array<{ id: string; title: string | null }>>([]);
  const [tapbenchBlockId, setTapbenchBlockId] = useState("");
  const [tapbenchMinutes, setTapbenchMinutes] = useState(15);
  const [mintingTapbench, setMintingTapbench] = useState(false);
  const [copiedTapbenchId, setCopiedTapbenchId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/workspace/tapbench-links?workspaceId=${encodeURIComponent(workspaceId)}`,
      );
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Failed to load TAPBench links");
      setTapbenchLinks(Array.isArray(data.tapbench_links) ? data.tapbench_links : []);

      try {
        const { createClient } = await import("@/lib/supabase/client");
        const supabase = createClient();
        const { data: blockRows } = await supabase
          .from("blocks")
          .select("id, title")
          .eq("workspace_id", workspaceId)
          .order("created_at", { ascending: true });
        setBlocks(blockRows || []);
      } catch {
        // blocks optional
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load TAPBench links");
    } finally {
      setLoading(false);
    }
  }, [workspaceId]);

  useEffect(() => {
    void load();
  }, [load]);

  const mintTapbenchLink = async () => {
    setMintingTapbench(true);
    setError(null);
    try {
      const res = await fetch("/api/workspace/tapbench-links", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          minutes: tapbenchMinutes,
          ...(tapbenchBlockId ? { blockId: tapbenchBlockId } : {}),
          ...(ayclToken ? { ayclToken } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create TAPBench link");
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create TAPBench link");
    } finally {
      setMintingTapbench(false);
    }
  };

  const copyTapbenchUrl = async (link: TapbenchLinkRow) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedTapbenchId(link.id);
      window.setTimeout(() => setCopiedTapbenchId(null), 2000);
    } catch {
      setError("Failed to copy TAPBench link");
    }
  };

  const downloadTapbenchSkills = (link: TapbenchLinkRow) => {
    const origin = typeof window !== "undefined" ? window.location.origin : undefined;
    const ok = downloadTapbenchSkillsMarkdown({
      workspace_id: link.workspace_id || workspaceId,
      block_id: link.block_id,
      id: link.id,
      session_token: link.public_token,
      url: link.url,
      exercise: link.exercise,
      duration_seconds: link.duration_seconds,
      expires_at: link.expires_at,
      remaining_ms: link.remaining_ms,
      status: link.status,
      baseUrl: origin,
    });
    if (!ok) {
      const md = buildTapbenchSkillsMarkdown({
        workspace_id: link.workspace_id || workspaceId,
        block_id: link.block_id,
        id: link.id,
        session_token: link.public_token,
        url: link.url,
        exercise: link.exercise,
        duration_seconds: link.duration_seconds,
        expires_at: link.expires_at,
        remaining_ms: link.remaining_ms,
        status: link.status,
        baseUrl: origin,
      });
      const a = document.createElement("a");
      a.href = `data:text/markdown;charset=utf-8,${encodeURIComponent(md)}`;
      a.download = TAPBENCH_SKILLS_MD_FILENAME;
      a.setAttribute("data-tapbench-skills-download-anchor", "1");
      a.click();
    }
  };

  return (
    <div className="space-y-4" data-tapbench-mint data-region-tapbench-links data-knowledge-links-tapbench>
      {error ? (
        <div className="rounded-lg border border-red-900/50 bg-red-950/30 px-3 py-2 text-xs text-red-300">
          {error}
        </div>
      ) : null}

      <div>
        <div className="text-[11px] font-medium uppercase tracking-wide text-neutral-500">
          TAPBench links
        </div>
        <p className="mt-1 text-xs leading-relaxed text-neutral-500">
          Mint a timed TAP exercise for agents. The link resolves to an exercise, remaining time,
          and a session token used with the Stash/Submit API until expiry. Flushed PoW is flagged
          as tapbench pow.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <label className="min-w-[10rem] flex-1 text-[11px] text-neutral-500">
          Scope
          <select
            value={tapbenchBlockId}
            onChange={(e) => setTapbenchBlockId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            data-tapbench-block-select
          >
            <option value="">Entire workspace</option>
            {blocks.map((b) => (
              <option key={b.id} value={b.id}>
                {b.title || b.id.slice(0, 8)}
              </option>
            ))}
          </select>
        </label>
        <label className="w-28 text-[11px] text-neutral-500">
          Minutes
          <input
            type="number"
            min={1}
            max={180}
            value={tapbenchMinutes}
            onChange={(e) => setTapbenchMinutes(Number(e.target.value) || 15)}
            className="mt-1 w-full rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-xs text-white"
            data-tapbench-minutes
          />
        </label>
        <button
          type="button"
          disabled={mintingTapbench}
          onClick={() => void mintTapbenchLink()}
          className={PRIMARY_CTA_CLASS}
          data-create-tapbench-link
        >
          {mintingTapbench ? "Creating…" : "Create TAPBench link"}
        </button>
      </div>

      {loading && tapbenchLinks.length === 0 ? (
        <p className="text-xs text-neutral-500">Loading TAPBench links…</p>
      ) : tapbenchLinks.length === 0 ? (
        <p className="text-xs text-neutral-500" data-tapbench-links-empty>
          No TAPBench links yet. Create one to evaluate agents via Stash/Submit.
        </p>
      ) : (
        <ul className="space-y-2" data-tapbench-links-list>
          {tapbenchLinks.map((link) => (
            <li
              key={link.id}
              className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 p-3"
              data-tapbench-link-id={link.id}
            >
              <div className="min-w-0 flex-1">
                <div className="line-clamp-2 text-xs text-neutral-200">{link.exercise}</div>
                <div className="mt-1 text-[10px] text-neutral-500">
                  {link.status} · {Math.round(link.duration_seconds / 60)} min · remaining{" "}
                  {Math.max(0, Math.round(link.remaining_ms / 1000))}s
                </div>
                <div
                  className="mt-1 break-all font-mono text-[10px] text-neutral-200/90"
                  data-tapbench-link-url
                >
                  {link.url}
                </div>
              </div>
              <div className="flex shrink-0 flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => downloadTapbenchSkills(link)}
                  className="rounded-md border border-neutral-800/60 bg-neutral-950/30 px-2.5 py-1.5 text-[11px] text-neutral-300 transition hover:border-white/60"
                  data-download-tapbench-skills
                  data-tapbench-skills-md
                  title={`Download ${TAPBENCH_SKILLS_MD_FILENAME} for agents (Stash/Submit)`}
                >
                  Download skills.md
                </button>
                <button
                  type="button"
                  onClick={() => void copyTapbenchUrl(link)}
                  className="rounded-md border border-neutral-600 px-2.5 py-1.5 text-[11px] text-white transition hover:border-neutral-400"
                  data-copy-tapbench-link
                >
                  {copiedTapbenchId === link.id ? "Copied" : "Copy link"}
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
