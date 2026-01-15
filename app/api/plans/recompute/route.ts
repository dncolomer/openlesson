import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { generateAdaptedChallenges } from "@/lib/openrouter";
import type { Challenge, Submission } from "@/lib/types";

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
    const body = await request.json();
    const { plan_id } = body;

    if (!plan_id) {
      return NextResponse.json(
        { error: "Plan ID is required" },
        { status: 400 }
      );
    }

    // Fetch plan and verify ownership
    const { data: plan, error: planError } = await supabase
      .from("plans")
      .select("*")
      .eq("id", plan_id)
      .eq("user_id", user.id)
      .single();

    if (planError || !plan) {
      return NextResponse.json(
        { error: "Plan not found" },
        { status: 404 }
      );
    }

    // Fetch existing challenges
    const { data: challenges, error: challengesError } = await supabase
      .from("challenges")
      .select("*")
      .eq("plan_id", plan_id)
      .order("order_index", { ascending: true });

    if (challengesError) {
      return NextResponse.json(
        { error: "Failed to fetch challenges" },
        { status: 500 }
      );
    }

    // Get completed challenges
    const completedChallenges = challenges?.filter(
      (c: Challenge) => c.status === "passed" || c.status === "failed"
    ) || [];

    if (completedChallenges.length === 0) {
      return NextResponse.json(
        { error: "No completed challenges to adapt from" },
        { status: 400 }
      );
    }

    // Fetch submissions to calculate average score
    const { data: submissions } = await supabase
      .from("submissions")
      .select("*")
      .eq("user_id", user.id)
      .in("challenge_id", completedChallenges.map((c: Challenge) => c.id));

    const scoredSubmissions = submissions?.filter(
      (s: Submission) => s.score !== null && s.status === "passed"
    ) || [];
    
    const averageScore = scoredSubmissions.length > 0
      ? scoredSubmissions.reduce((acc: number, s: Submission) => acc + (s.score || 0), 0) / scoredSubmissions.length
      : 70; // Default to 70 if no scored submissions

    // Determine how many new challenges to generate
    const pendingChallenges = challenges?.filter(
      (c: Challenge) => c.status === "pending" || c.status === "in_progress"
    ) || [];
    
    // Only generate if we have fewer than 3 pending challenges
    if (pendingChallenges.length >= 3) {
      return NextResponse.json({
        message: "Enough pending challenges exist",
        updated_challenges: [],
      });
    }

    const numNewChallenges = Math.min(3 - pendingChallenges.length, 3);

    // Generate adapted challenges
    const newChallengeContent = await generateAdaptedChallenges(
      plan.topic,
      completedChallenges,
      averageScore,
      numNewChallenges
    );

    // Use admin client to insert new challenges
    const adminClient = createAdminClient();

    // Get the next order index
    const maxOrderIndex = challenges?.length || 0;

    const challengesToInsert = newChallengeContent.map((challenge, index) => ({
      plan_id: plan.id,
      order_index: maxOrderIndex + index,
      title: challenge.title,
      description: challenge.description,
      success_criteria: challenge.success_criteria,
      hints: challenge.hints || [],
      status: "pending",
    }));

    const { data: newChallenges, error: insertError } = await adminClient
      .from("challenges")
      .insert(challengesToInsert)
      .select()
      .order("order_index", { ascending: true });

    if (insertError) {
      console.error("Error inserting adapted challenges:", insertError);
      return NextResponse.json(
        { error: "Failed to create adapted challenges" },
        { status: 500 }
      );
    }

    // Update plan's updated_at timestamp
    await adminClient
      .from("plans")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", plan_id);

    return NextResponse.json({
      message: "Plan recomputed successfully",
      updated_challenges: newChallenges,
      average_score: Math.round(averageScore),
    });
  } catch (error) {
    console.error("Error in plan recomputation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
