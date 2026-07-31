/**
 * Public TAPBench link resolve at `/tapbench/{token}`.
 * Yields exercise, remaining time, session token, and skills.md for agents using Stash/Submit.
 */

import { notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTapbenchSessionToken } from "@/lib/pow-api/tapbench-store";
import { TAPBENCH_PRODUCT, buildTapbenchShareUrl } from "@/lib/pow-api/tapbench";
import {
  TAPBENCH_SKILLS_MD_FILENAME,
  buildTapbenchSkillsMarkdown,
} from "@/lib/pow-api/tapbench-skills-md";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ token: string }>;
}

export default async function TapbenchResolvePage({ params }: PageProps) {
  const { token: rawToken } = await params;
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!token) notFound();

  let supabase = null as ReturnType<typeof createAdminClient> | null;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = null;
  }

  const resolved = await resolveTapbenchSessionToken(supabase, token);

  if (!resolved.ok) {
    if (resolved.code === "not_found") notFound();
    return (
      <main
        className="min-h-screen bg-[#0a0a0a] px-6 py-16 text-zinc-200"
        data-tapbench-resolve
        data-tapbench-status={resolved.code}
      >
        <div className="mx-auto max-w-xl rounded-lg border border-red-900/50 bg-red-950/20 p-6">
          <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">
            {TAPBENCH_PRODUCT.name}
          </p>
          <h1 className="mt-2 text-xl font-medium text-white">
            {resolved.code === "session_expired"
              ? "Session expired"
              : "Session unavailable"}
          </h1>
          <p className="mt-2 text-sm text-zinc-400">{resolved.message}</p>
          {"expires_at" in resolved ? (
            <p className="mt-3 font-mono text-xs text-zinc-500">
              expired at {resolved.expires_at}
            </p>
          ) : null}
        </div>
      </main>
    );
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") || "https://uncertain.systems";
  const shareUrl = buildTapbenchShareUrl(base, resolved.session_token);
  const remainingSec = Math.max(0, Math.round(resolved.remaining_ms / 1000));
  const skillsPath = `/api/tapbench/${encodeURIComponent(resolved.session_token)}/skills`;
  const skillsUrl = `${base}${skillsPath}`;
  const skillsMarkdown = buildTapbenchSkillsMarkdown({
    workspace_id: resolved.workspace_id,
    block_id: resolved.block_id,
    id: resolved.link.id,
    session_token: resolved.session_token,
    url: shareUrl,
    exercise: resolved.exercise,
    duration_seconds: resolved.duration_seconds,
    expires_at: resolved.expires_at,
    remaining_ms: resolved.remaining_ms,
    status: resolved.link.status,
    baseUrl: base,
  });

  return (
    <main
      className="min-h-screen bg-[#0a0a0a] px-6 py-16 text-zinc-200"
      data-tapbench-resolve
      data-tapbench-status="active"
    >
      <div className="mx-auto max-w-2xl space-y-6">
        <div>
          <p className="font-mono text-[10px] tracking-[2px] text-zinc-500">
            {TAPBENCH_PRODUCT.name}
          </p>
          <h1 className="mt-2 text-2xl font-medium tracking-tight text-white">
            TAPBench exercise
          </h1>
          <p className="mt-1 text-sm text-zinc-400">
            Load{" "}
            <a
              href={skillsPath}
              className="text-cyan-400 underline decoration-cyan-700 underline-offset-2 hover:text-cyan-300"
              data-tapbench-skills-md-link
            >
              {TAPBENCH_SKILLS_MD_FILENAME}
            </a>{" "}
            for agent instructions, then use Stash/Submit until time runs out.
          </p>
        </div>

        <section
          className="rounded-lg border border-cyan-900/40 bg-cyan-950/15 p-5"
          data-tapbench-skills-md
          data-tapbench-skills-filename={TAPBENCH_SKILLS_MD_FILENAME}
        >
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-cyan-500/90">
            Agent skill — {TAPBENCH_SKILLS_MD_FILENAME}
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-300">
            This TAPBench link ships a{" "}
            <strong className="font-medium text-zinc-100">{TAPBENCH_SKILLS_MD_FILENAME}</strong>{" "}
            file: continuous multi-thought buffering, when to{" "}
            <span className="text-zinc-100">Stash (System 1)</span> vs{" "}
            <span className="text-zinc-100">Submit (System 2)</span>, endpoints, and
            session credentials. Agents should load it before solving.
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <a
              href={skillsPath}
              download={TAPBENCH_SKILLS_MD_FILENAME}
              className="inline-flex items-center rounded-md border border-cyan-700/50 bg-cyan-950/40 px-3 py-1.5 text-xs font-medium text-cyan-200 hover:bg-cyan-900/40"
              data-download-tapbench-skills
              data-tapbench-skills-download
            >
              Download {TAPBENCH_SKILLS_MD_FILENAME}
            </a>
            <code
              className="break-all font-mono text-[10px] text-zinc-500"
              data-tapbench-skills-url
            >
              GET {skillsUrl}
            </code>
          </div>
          <p className="mt-3 font-mono text-[10px] text-zinc-600">
            Machine: GET /api/tapbench/{"{token}"}/skills → text/markdown (
            {TAPBENCH_SKILLS_MD_FILENAME})
          </p>
        </section>

        <section
          className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-5"
          data-tapbench-exercise
        >
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Exercise
          </h2>
          <p className="mt-2 text-sm leading-relaxed text-zinc-100">{resolved.exercise}</p>
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <div
            className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4"
            data-tapbench-remaining
          >
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Remaining
            </div>
            <div className="mt-1 font-mono text-lg text-cyan-400">
              {remainingSec}s
            </div>
            <div className="mt-1 text-[10px] text-zinc-600">
              of {resolved.duration_seconds}s · expires {resolved.expires_at}
            </div>
          </div>
          <div
            className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-4"
            data-tapbench-session-token
          >
            <div className="text-[11px] uppercase tracking-wide text-zinc-500">
              Session token
            </div>
            <code className="mt-1 block break-all font-mono text-xs text-zinc-200">
              {resolved.session_token}
            </code>
          </div>
        </section>

        <section
          className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-5"
          data-tapbench-stash-instructions
        >
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            Stash / Submit API
          </h2>
          <p className="mt-1 text-xs text-zinc-500">
            Full protocol is in{" "}
            <a
              href={skillsPath}
              className="text-cyan-500/90 underline decoration-cyan-800 underline-offset-2"
              data-tapbench-skills-md-link
            >
              {TAPBENCH_SKILLS_MD_FILENAME}
            </a>
            : buffer continuous distinct thoughts, stash intermediate (System 1), submit
            deliberate answers (System 2).
          </p>
          <ul className="mt-2 space-y-1 font-mono text-[11px] text-zinc-400">
            <li>
              Header:{" "}
              <span className="text-zinc-200">X-Tapbench-Session: {resolved.session_token}</span>
            </li>
            <li>
              POST /api/v3/stash/workspaces/{resolved.workspace_id}/proof-of-work
            </li>
            <li>POST /api/v3/stash/workspaces/{resolved.workspace_id}/stash</li>
            <li>POST /api/v3/stash/workspaces/{resolved.workspace_id}/submit</li>
          </ul>
          <p className="mt-3 text-xs text-zinc-500">
            Machine resolve: GET /api/tapbench/{resolved.session_token}
          </p>
          <p className="mt-1 break-all font-mono text-[10px] text-zinc-600" data-tapbench-share-url>
            {shareUrl}
          </p>
        </section>

        {/* Full skills.md body for agents that scrape HTML / read the page source */}
        <section
          className="rounded-lg border border-zinc-800 bg-zinc-950/80 p-5"
          data-tapbench-skills-md-body
          data-tapbench-skills-filename={TAPBENCH_SKILLS_MD_FILENAME}
        >
          <h2 className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">
            {TAPBENCH_SKILLS_MD_FILENAME} (inline)
          </h2>
          <pre
            className="mt-3 max-h-80 overflow-auto whitespace-pre-wrap break-words font-mono text-[10px] leading-relaxed text-zinc-400"
            data-tapbench-skills-md-content
          >
            {skillsMarkdown}
          </pre>
        </section>

        <script
          type="application/json"
          id="tapbench-session-json"
          data-tapbench-json
          // JSON payload for agents scraping the page
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              product: TAPBENCH_PRODUCT,
              exercise: resolved.exercise,
              remaining_ms: resolved.remaining_ms,
              duration_seconds: resolved.duration_seconds,
              expires_at: resolved.expires_at,
              session_token: resolved.session_token,
              workspace_id: resolved.workspace_id,
              block_id: resolved.block_id,
              tapbench_link_id: resolved.link.id,
              url: shareUrl,
              skills_md_filename: TAPBENCH_SKILLS_MD_FILENAME,
              skills_md_url: skillsUrl,
              skills_md_path: skillsPath,
              note: `Load ${TAPBENCH_SKILLS_MD_FILENAME} from skills_md_url before solving. Continuous thoughts + stash (System 1) / submit (System 2).`,
            }),
          }}
        />
      </div>
    </main>
  );
}
