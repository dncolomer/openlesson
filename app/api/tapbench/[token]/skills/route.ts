/**
 * Public TAPBench skills.md for a session token.
 * Agents visiting /tapbench/{token} should load this file for Stash/Submit protocol.
 */

import { NextRequest, NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { resolveTapbenchSessionToken } from "@/lib/pow-api/tapbench-store";
import {
  TAPBENCH_SKILLS_MD_FILENAME,
  buildTapbenchSkillsMarkdown,
} from "@/lib/pow-api/tapbench-skills-md";
import { TAPBENCH_PRODUCT } from "@/lib/pow-api/tapbench";

export const runtime = "nodejs";

interface RouteProps {
  params: Promise<{ token: string }>;
}

export async function GET(req: NextRequest, { params }: RouteProps) {
  const { token: raw } = await params;
  const token = typeof raw === "string" ? raw.trim() : "";
  if (!token) {
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
          ...("expires_at" in resolved
            ? { expires_at: resolved.expires_at, remaining_ms: 0 }
            : {}),
        },
        product: TAPBENCH_PRODUCT,
      },
      { status },
    );
  }

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    `${req.nextUrl.protocol}//${req.nextUrl.host}`;

  const markdown = buildTapbenchSkillsMarkdown({
    workspace_id: resolved.workspace_id,
    block_id: resolved.block_id,
    id: resolved.link.id,
    session_token: resolved.session_token,
    url: `${base}/tapbench/${resolved.session_token}`,
    exercise: resolved.exercise,
    duration_seconds: resolved.duration_seconds,
    expires_at: resolved.expires_at,
    remaining_ms: resolved.remaining_ms,
    status: resolved.link.status,
    baseUrl: base,
  });

  const asJson =
    req.nextUrl.searchParams.get("format") === "json" ||
    (req.headers.get("accept") || "").includes("application/json");

  if (asJson) {
    return NextResponse.json({
      filename: TAPBENCH_SKILLS_MD_FILENAME,
      content_type: "text/markdown; charset=utf-8",
      markdown,
      session_token: resolved.session_token,
      workspace_id: resolved.workspace_id,
      block_id: resolved.block_id,
      tapbench_link_id: resolved.link.id,
    });
  }

  return new NextResponse(markdown, {
    status: 200,
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${TAPBENCH_SKILLS_MD_FILENAME}"`,
      "Cache-Control": "no-store",
      "X-Tapbench-Skills-Filename": TAPBENCH_SKILLS_MD_FILENAME,
    },
  });
}
