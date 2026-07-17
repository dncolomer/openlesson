import { NextRequest, NextResponse } from "next/server";
import { generateProbe } from "@/lib/xai";
import { getUserPrompts } from "@/lib/user-prompts";
import type { RequestType, SessionPlan } from "@/lib/storage";
import { getLanguageName } from "@/lib/tutoring-languages";
import { ayclTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { 
      problem, 
      gapScore, 
      signals, 
      previousProbes, 
      archivedProbes,
      ragContext, 
      audioBase64, 
      audioFormat, 
      objectives,
      sessionPlan,
      requestType,
      sessionId,
      tutoringLanguage: bodyLanguage,
    } = body;

    if (!problem) {
      return NextResponse.json({ error: "Missing problem" }, { status: 400 });
    }
    if (typeof gapScore !== "number") {
      return NextResponse.json({ error: "Missing gapScore" }, { status: 400 });
    }

    const auth = await guardSessionRoute(sessionId, {
      ayclToken: ayclTokenFromBody(body),
      // Prefer binding to a session when provided; product access always enforced for cookie auth.
    });
    if (!auth.ok) return auth.response;
    const { supabase } = auth;

    // Get tutoring language from body or session metadata
    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage && sessionId) {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", sessionId)
        .single();
      if (sessionData?.metadata?.tutoringLanguage) {
        tutoringLanguage = sessionData.metadata.tutoringLanguage;
      }
    }
    const languageName = tutoringLanguage ? getLanguageName(tutoringLanguage) : undefined;

    const promptOverrides = await getUserPrompts();

    // Build enhanced context with session plan and archived probes
    let enhancedRagContext = ragContext || "";
    if (sessionPlan) {
      const plan = sessionPlan as SessionPlan;
      const currentStep = plan.steps[plan.currentStepIndex];
      const completedSteps = plan.steps.filter(s => s.status === "completed");
      const planContext = `
SESSION PLAN CONTEXT:
- Goal: ${plan.goal}
- Current step (${plan.currentStepIndex + 1}/${plan.steps.length}): [${currentStep?.type || "question"}] ${currentStep?.description || "Continue guiding"}
- Progress: ${completedSteps.length}/${plan.steps.length} steps completed
${completedSteps.length > 0 ? `- Completed steps: ${completedSteps.map((s, i) => `${i + 1}. ${s.description}`).join("; ")}` : ""}

IMPORTANT: Your question MUST be specifically about the current step topic: "${currentStep?.description || "Continue guiding"}". Stay concrete and specific to this step. Do not ask abstract or meta questions.
`;
      enhancedRagContext = planContext + (ragContext ? `\n\n${ragContext}` : "");
    }

    // Add archived probes context so LLM knows what's been covered
    if (archivedProbes && Array.isArray(archivedProbes) && archivedProbes.length > 0) {
      const archivedContext = `\nALREADY COVERED (archived probes — do NOT revisit these topics, build forward):\n${archivedProbes.map((p: string) => `- ${p}`).join("\n")}\n`;
      enhancedRagContext = enhancedRagContext + archivedContext;
    }

    const result = await generateProbe({
      problem,
      gapScore,
      signals: signals || [],
      previousProbes: previousProbes || [],
      ragContext: enhancedRagContext,
      audioBase64,
      audioFormat,
      promptOverrides,
      objectives,
      tutoringLanguage: languageName,
    });

    if (!result.success) {
      return NextResponse.json({ error: result.error || "Probe generation failed" }, { status: 500 });
    }

    // Determine request type based on session plan if not explicitly provided
    let finalRequestType: RequestType = requestType || "question";
    if (!requestType && sessionPlan) {
      const plan = sessionPlan as SessionPlan;
      const currentStep = plan.steps[plan.currentStepIndex];
      if (currentStep?.type) {
        finalRequestType = currentStep.type;
      }
    }

    return NextResponse.json({ 
      probe: result.probe,
      requestType: finalRequestType,
    });
  } catch (error) {
    console.error("Generate probe error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
