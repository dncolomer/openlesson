import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generatePlanContent } from "@/lib/openrouter";
import type { GeneratePlanRequest } from "@/lib/types";

export async function POST(request: Request) {
  try {
    // Get authenticated user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    // Parse request body
    const body: GeneratePlanRequest = await request.json();
    const { topic, context, difficulty = "beginner", num_challenges = 5 } = body;

    if (!topic || typeof topic !== "string" || topic.trim().length === 0) {
      return NextResponse.json(
        { error: "Topic is required" },
        { status: 400 }
      );
    }

    // Validate num_challenges
    const challengeCount = Math.min(Math.max(num_challenges, 3), 10);

    // Generate plan content using AI
    const planContent = await generatePlanContent({
      topic: topic.trim(),
      context: context?.trim(),
      difficulty,
      num_challenges: challengeCount,
    });

    // Build the prompt used for transparency
    const promptUsed = `Topic: ${topic}${context ? `\nContext: ${context}` : ""}\nDifficulty: ${difficulty}\nChallenges: ${challengeCount}`;

    // Use admin client to insert (bypasses RLS for challenges)
    const adminClient = createAdminClient();

    // Insert plan
    const { data: plan, error: planError } = await adminClient
      .from("plans")
      .insert({
        user_id: user.id,
        topic: topic.trim(),
        description: planContent.description,
        prompt_used: promptUsed,
        metadata: {
          difficulty,
          tags: [topic.toLowerCase()],
          model_used: "google/gemini-3-pro-preview",
        },
        status: "active",
      })
      .select()
      .single();

    if (planError) {
      console.error("Error creating plan:", planError);
      return NextResponse.json(
        { error: "Failed to create plan" },
        { status: 500 }
      );
    }

    // Insert challenges
    const challengesToInsert = planContent.challenges.map((challenge, index) => ({
      plan_id: plan.id,
      order_index: index,
      title: challenge.title,
      description: challenge.description,
      success_criteria: challenge.success_criteria,
      hints: challenge.hints || [],
      status: "pending",
    }));

    const { data: challenges, error: challengesError } = await adminClient
      .from("challenges")
      .insert(challengesToInsert)
      .select()
      .order("order_index", { ascending: true });

    if (challengesError) {
      console.error("Error creating challenges:", challengesError);
      // Clean up the plan if challenges failed
      await adminClient.from("plans").delete().eq("id", plan.id);
      return NextResponse.json(
        { error: "Failed to create challenges" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      plan,
      challenges,
    });
  } catch (error) {
    console.error("Error in plan generation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
