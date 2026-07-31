/**
 * Public TAPBench link resolve — exercise + remaining time + session token.
 * Agents open this link (or call this API) to obtain session credentials for Stash/Submit.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTapbenchSessionToken } from "@/lib/pow-api/tapbench-store";
import { TAPBENCH_PRODUCT } from "@/lib/pow-api/tapbench";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const { token } = await params;
  if (!token?.trim()) {
    return NextResponse.json(
      { error: { code: "not_found", message: "TAPBench session not found" } },
      { status: 404 },
    );
  }

  let supabase;
  try {
    supabase = createAdminClient();
  } catch {
    supabase = null;
  }

  const resolved = await resolveTapbenchSessionToken(supabase, token);

  if (!resolved.ok) {
    const status = resolved.code === "not_found" ? 404 : 401;
    return NextResponse.json(
      {
        error: {
          code: resolved.code,
          message: resolved.message,
          ...("expires_at" in resolved ? { expires_at: resolved.expires_at, remaining_ms: 0 } : {}),
        },
        product: TAPBENCH_PRODUCT,
      },
      { status },
    );
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const origin = base.replace(/\/$/, "");
  const sessionToken = resolved.session_token;
  const skillsPath = `/api/tapbench/${encodeURIComponent(sessionToken)}/skills`;

  return NextResponse.json({
    product: TAPBENCH_PRODUCT,
    exercise: resolved.exercise,
    remaining_ms: resolved.remaining_ms,
    duration_seconds: resolved.duration_seconds,
    expires_at: resolved.expires_at,
    session_token: sessionToken,
    workspace_id: resolved.workspace_id,
    block_id: resolved.block_id,
    guest_user_id: resolved.guest_user_id,
    tapbench_link_id: resolved.link.id,
    skills_md_filename: "skills.md",
    skills_md_path: skillsPath,
    skills_md_url: `${origin}${skillsPath}`,
    skills_md_note:
      "Download or GET skills_md_url for the agent skill file (continuous multi-thought buffer → stash System 1 / submit System 2). Prefer loading skills.md before solving.",
    stash: {
      ingest: `POST /api/v3/stash/workspaces/${resolved.workspace_id}/proof-of-work`,
      stash: `POST /api/v3/stash/workspaces/${resolved.workspace_id}/stash`,
      submit: `POST /api/v3/stash/workspaces/${resolved.workspace_id}/submit`,
      session_header: "X-Tapbench-Session",
      note: "Pass session_token as X-Tapbench-Session header (or body.session_token) on stash/submit until remaining_ms is 0. Follow skills.md: continuous distinct thoughts, stash intermediate (System 1), submit deliberate (System 2). Flushed PoW is TAP thought-trace shaped (metadata.text, tool_name stash_submit_api) and attributed to guest_user_id.",
    },
    url: `${origin}/tapbench/${sessionToken}`,
  });
}
