import { NextRequest, NextResponse } from "next/server";
import { generateReport } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { problem, duration, probeCount, avgGapScore, probesSummary, eegContext } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }

    const promptOverrides = await getUserPrompts();

    const result = await generateReport({
      problem,
      duration: duration || "unknown",
      probeCount: probeCount || 0,
      avgGapScore: avgGapScore || 0,
      probesSummary: probesSummary || "",
      eegContext,
      promptOverrides,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Report generation failed" }, { status: 500 });
    }

    return NextResponse.json({ report: result.report });
  } catch (error) {
    console.error("Generate report error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
