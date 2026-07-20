import { NextRequest, NextResponse } from "next/server";
import { getSessionPlan, updateSessionPlan } from "@/lib/storage";
import { callXaiJSON, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { ayclTokenFromBody,
  ileTokenFromBody, guardSessionRoute } from "@/lib/api/require-auth";
import { getLanguageName } from "@/lib/tutoring-languages";

export const runtime = "nodejs";
export const maxDuration = 30;

interface SessionPlanStep {
  id: string;
  type: string;
  description: string;
  status: string;
  order: number;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { sessionId, tutoringLanguage: bodyLanguage, objectives } = body;

    if (!sessionId) {
      return NextResponse.json(
        { error: "Missing sessionId" },
        { status: 400 }
      );
    }

    const auth = await guardSessionRoute(sessionId, { ayclToken: ayclTokenFromBody(body), ileToken: ileTokenFromBody(body) });
    if (!auth.ok) return auth.response;

    const { supabase } = auth;

    let tutoringLanguage = bodyLanguage;
    if (!tutoringLanguage) {
      const { data: sessionData } = await supabase
        .from("sessions")
        .select("metadata")
        .eq("id", sessionId)
        .single();
      if (sessionData?.metadata?.tutoringLanguage) {
        tutoringLanguage = sessionData.metadata.tutoringLanguage;
      }
    }

    if (!tutoringLanguage) {
      return NextResponse.json(
        { error: "Missing tutoringLanguage" },
        { status: 400 }
      );
    }

    const languageName = getLanguageName(tutoringLanguage);
    const existingPlan = await getSessionPlan(sessionId, supabase);

    if (!existingPlan) {
      return NextResponse.json(
        { error: "No existing plan to translate" },
        { status: 400 }
      );
    }

    const stepsJson = JSON.stringify(
      existingPlan.steps.map((step: SessionPlanStep) => ({
        id: step.id,
        type: step.type,
        description: step.description,
        status: step.status,
        order: step.order,
      })),
      null,
      2
    );

    const translationPrompt = `You are a translator. Translate the following learning session plan to ${languageName}.

IMPORTANT: 
- Translate ONLY the text content, NOT the structure
- Keep all step IDs, types, statuses, and orders EXACTLY the same
- Preserve the status of each step (e.g., if a step is "completed" or "in_progress", keep it that way)
- Only translate: goal, strategy, description, and each step's description field

Original Plan:
- Goal: ${existingPlan.goal}
- Strategy: ${existingPlan.strategy || "N/A"}
- Description: ${existingPlan.description || "N/A"}
- Steps: ${stepsJson}

Return ONLY valid JSON (no markdown, no explanation):
{
  "goal": "translated goal",
  "strategy": "translated strategy", 
  "description": "translated description",
  "steps": [
    {"id": "same-id", "type": "same-type", "description": "translated description", "status": "same-status", "order": same-order},
    ...
  ]
}`;

    const response = await callXaiJSON<{
      goal: string;
      strategy: string;
      description: string;
      steps: SessionPlanStep[];
    }>(
      [userMessage(translationPrompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 1500,
        temperature: 0.3,
      }
    );

    if (!response.success || !response.data) {
      console.error("[Translate] LLM call failed:", response.error);
      return NextResponse.json(
        { error: response.error || "Translation failed" },
        { status: 500 }
      );
    }

    const translatedSteps = response.data.steps || [];
    if (translatedSteps.length === 0) {
      console.error("[Translate] No steps in response:", response.data);
      return NextResponse.json(
        { error: "Translation produced no steps" },
        { status: 500 }
      );
    }

    const finalSteps = translatedSteps.map((translatedStep: SessionPlanStep, idx: number) => {
      const originalStep = existingPlan.steps[idx];
      return {
        id: originalStep?.id || translatedStep.id || `step_${idx + 1}`,
        type: originalStep?.type || translatedStep.type || "question",
        description: translatedStep.description || originalStep?.description || "",
        status: originalStep?.status || translatedStep.status || "pending",
        order: originalStep?.order || translatedStep.order || idx + 1,
      };
    }).filter((step: SessionPlanStep) => step.description && step.description.trim().length > 0);

    const updatedPlan = await updateSessionPlan(
      existingPlan.id,
      {
        goal: response.data.goal || existingPlan.goal,
        strategy: response.data.strategy || existingPlan.strategy,
        steps: finalSteps,
      },
      supabase
    );

    return NextResponse.json({ plan: updatedPlan });
  } catch (error) {
    console.error("Translate session plan error:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Internal server error: ${errorMessage}` },
      { status: 500 }
    );
  }
}