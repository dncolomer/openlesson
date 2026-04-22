import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { callXaiText, userMessage, DEFAULT_MODEL } from "@/lib/xai-client";

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { topic } = await req.json();

    if (!topic || typeof topic !== "string") {
      return NextResponse.json({ error: "Topic is required" }, { status: 400 });
    }

    const prompt = `Generate preparation material for a tutoring session on the topic: "${topic}"

Create a comprehensive guide that includes:

## 1. Key Concepts to Review
- 3-5 important foundational concepts related to this topic
- Brief explanations of each (1-2 sentences)

## 2. External Resources
- 2-3 helpful external links (real, existing URLs to reputable sources like Wikipedia, Khan Academy, MIT OpenCourseWare, etc.)
- Include a one-sentence description of why each is useful

## 3. Mini Preparation Activity
- A small hands-on exercise, thought experiment, or practical application to try before the session
- Should take 5-15 minutes

## 4. What to Expect
- 1-2 sentences about what the session will focus on and what kind of questions you'll be asked

Format the response in clear markdown. Be concise but helpful. The goal is to help the learner feel prepared, not overwhelmed.`;

    const response = await callXaiText(
      [userMessage(prompt)],
      {
        model: DEFAULT_MODEL,
        maxTokens: 1500,
        temperature: 0.6,
      }
    );

    if (!response.success || !response.data) {
      console.error("xAI error:", response.error);
      return NextResponse.json({ error: "Failed to generate material" }, { status: 500 });
    }

    return NextResponse.json({
      content: response.data,
      relevantChunks: [],
    });
  } catch (error) {
    console.error("Prepare session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
