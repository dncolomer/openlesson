import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { requireAuthenticatedProductUser } from "@/lib/api/require-auth";

export const runtime = "nodejs";
export const maxDuration = 30;

interface GrokipediaTermsRequest {
  sessionProblem: string;
  currentPlanStep?: string;
  activeProbes?: Array<{ text: string }>;
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireAuthenticatedProductUser();
    if (!auth.ok) return auth.response;

    const body: GrokipediaTermsRequest = await request.json();
    const { sessionProblem, currentPlanStep, activeProbes } = body;

    if (!sessionProblem) {
      return jsonError(400, "Missing sessionProblem");
    }

    // Build context for the LLM
    const probeTexts = activeProbes?.map(p => p.text).filter(Boolean) || [];
    const probesContext = probeTexts.length > 0 
      ? `\nActive learning questions/tasks:\n${probeTexts.map(t => `- ${t}`).join('\n')}`
      : '';
    
    const stepContext = currentPlanStep 
      ? `\nCurrent learning objective: ${currentPlanStep}`
      : '';

    const prompt = `You are helping a student use the Grok / Grokipedia tool. Grokipedia is an educational search engine, and the same panel also has a Grok prompt bar for custom questions on grok.com.

Based on the following learning context, generate 5-8 specific search terms that would help the student find relevant educational content.

Topic: ${sessionProblem}${stepContext}${probesContext}

Guidelines:
- Terms should be specific enough to yield focused results
- Include both foundational concepts and more specific topics from the current context
- Prioritize terms directly relevant to the active questions/tasks if present
- Keep each term concise (2-5 words typically)
- Order by relevance (most helpful first)

Return ONLY a JSON array of search term strings, nothing else. Example format:
["term one", "term two", "term three"]`;

    const response = await callXaiText(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 300,
        temperature: 0.7,
      }
    );

    if (!response.success || !response.data) {
      return jsonError(500, "Failed to generate suggestions");
    }

    // Parse the JSON array from the response
    let terms: string[] = [];
    try {
      // Clean up response - extract JSON array
      const cleaned = response.data.trim();
      // Try to find JSON array in the response
      const jsonMatch = cleaned.match(/\[[\s\S]*\]/);
      if (jsonMatch) {
        terms = JSON.parse(jsonMatch[0]);
      } else {
        // Fallback: split by newlines or commas if not valid JSON
        terms = cleaned.split(/[\n,]+/).map(t => t.trim().replace(/^["'-]+|["'-]+$/g, '')).filter(Boolean);
      }
    } catch {
      // Last resort fallback
      terms = response.data.split(/[\n,]+/).map(t => t.trim().replace(/^["'-]+|["'-]+$/g, '')).filter(Boolean);
    }

    // Ensure we have valid terms and limit to 8
    terms = terms.filter(t => typeof t === 'string' && t.length > 0).slice(0, 8);

    return NextResponse.json({ terms });
  } catch (error) {
    console.error("Suggest grokipedia terms error:", error);
    return jsonError(500, "Internal server error");
  }
}
