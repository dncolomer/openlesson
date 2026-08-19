import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";
import { requireAuthenticatedProductUser } from "@/lib/api/require-auth";

export async function GET(req: NextRequest) {
  try {
    const auth = await requireAuthenticatedProductUser();
    if (!auth.ok) return auth.response;
    const { searchParams } = new URL(req.url);
    const topic = searchParams.get("topic");
    const type = searchParams.get("type");
    const step = searchParams.get("step"); // optional step context

    if (!topic) {
      return jsonError(400, "Topic is required");
    }

    let prompt = "";
    let title = "";

    // When a step is provided, tailor content to that specific step
    const contextLine = step
      ? `The session topic is "${topic}". The student is currently working on this specific step: "${step}"`
      : `a tutoring session on the topic: "${topic}"`;

    switch (type) {
      case "reading":
        title = step ? "Step Resources" : "Theory";
        if (step) {
          prompt = `${contextLine}

Generate 3-5 relevant external resources (with real URLs) that will help the student with this specific step.

Requirements:
- Only include REAL, working URLs from reputable sources (Wikipedia, Khan Academy, MIT OCW, MDN, official docs, YouTube educational channels, etc.)
- Each resource should have: **[Resource Name](URL)** — 1 sentence explaining how it helps with this step
- Focus on resources directly relevant to the step, not the broad topic
- Include a mix: reference material, tutorials, and video explanations where applicable
- Format as a markdown list`;
        } else {
          prompt = `Generate 2-3 brief reading materials (key concepts, definitions, or explanations) for ${contextLine}

Format as a concise, scannable list. Each item should be 1-3 sentences max. Use bullet points.
Focus on foundational concepts the student should understand before the session.
Keep it minimal - this is just prep material, not a full lesson.`;
        }
        break;
      case "exercise":
        title = step ? "Step Practice" : "Practice";
        if (step) {
          prompt = `${contextLine}

Generate a focused practice exercise that directly helps the student master this step.

Requirements:
- The exercise should be completable in 5-10 minutes
- Break it into 2-4 clear sub-tasks that build on each other
- Make it hands-on and practical, not just reading
- Tailor difficulty to what this step requires
- Do NOT include solutions — the student should work through it
- Format clearly with numbered steps`;
        } else {
          prompt = `Generate a brief exercise or task (5-15 minutes) for a student to complete before ${contextLine}

Format as a single, clear activity with 2-3 sub-steps if needed.
Keep it practical and thought-provoking. The exercise should help them think about the topic before the session.
Do NOT include any solutions or answers - this is for them to discover during the session.`;
        }
        break;
      case "resources":
        title = "Helpful Resources";
        prompt = `Generate 2-3 helpful external resources (links) for learning about: "${topic}"${step ? `, specifically for: "${step}"` : ""}

Format as a list with just the resource name and URL.
Only include real, reputable sources (Wikipedia, Khan Academy, MIT OpenCourseWare, official documentation, etc.).
Include a very brief (5 words max) description of why each is useful.`;
        break;
      default:
        return jsonError(400, "Invalid type");
    }

    const response = await callXaiText(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: step ? 1200 : 800,
        temperature: 0.6,
      }
    );

    if (!response.success || !response.data) {
      console.error("xAI API error:", response.error);
      return jsonError(500, "Failed to generate material");
    }

    return NextResponse.json({ title, content: response.data });
  } catch (error) {
    console.error("Prep material error:", error);
    return jsonError(500, "Internal server error");
  }
}
