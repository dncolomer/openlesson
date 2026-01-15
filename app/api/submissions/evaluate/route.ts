import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { evaluateSubmission } from "@/lib/openrouter";
import type { Challenge } from "@/lib/types";

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
    const { challenge_id, content } = body;

    if (!challenge_id) {
      return NextResponse.json(
        { error: "Challenge ID is required" },
        { status: 400 }
      );
    }

    if (!content || typeof content !== "string" || content.trim().length === 0) {
      return NextResponse.json(
        { error: "Submission content is required" },
        { status: 400 }
      );
    }

    // Fetch challenge and verify user has access (through plan ownership)
    const { data: challenge, error: challengeError } = await supabase
      .from("challenges")
      .select(`
        *,
        plans!inner(user_id)
      `)
      .eq("id", challenge_id)
      .single();

    if (challengeError || !challenge) {
      return NextResponse.json(
        { error: "Challenge not found" },
        { status: 404 }
      );
    }

    // Verify user owns the plan
    if (challenge.plans.user_id !== user.id) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 403 }
      );
    }

    // Create submission with pending status
    const adminClient = createAdminClient();
    
    const { data: submission, error: submissionError } = await adminClient
      .from("submissions")
      .insert({
        challenge_id,
        user_id: user.id,
        content: content.trim(),
        status: "evaluating",
      })
      .select()
      .single();

    if (submissionError) {
      console.error("Error creating submission:", submissionError);
      return NextResponse.json(
        { error: "Failed to create submission" },
        { status: 500 }
      );
    }

    // Evaluate submission using AI
    const evaluation = await evaluateSubmission(
      challenge as Challenge,
      content.trim()
    );

    // Update submission with evaluation results
    const { data: updatedSubmission, error: updateError } = await adminClient
      .from("submissions")
      .update({
        status: evaluation.passed ? "passed" : "failed",
        feedback: evaluation.feedback,
        score: evaluation.score,
      })
      .eq("id", submission.id)
      .select()
      .single();

    if (updateError) {
      console.error("Error updating submission:", updateError);
      return NextResponse.json(
        { error: "Failed to update submission" },
        { status: 500 }
      );
    }

    // If passed, update challenge status
    if (evaluation.passed) {
      await adminClient
        .from("challenges")
        .update({ status: "passed" })
        .eq("id", challenge_id);

      // Check if all challenges are completed to mark plan as complete
      const { data: allChallenges } = await adminClient
        .from("challenges")
        .select("status")
        .eq("plan_id", challenge.plan_id);

      const allPassed = allChallenges?.every(
        (c: { status: string }) => c.status === "passed"
      );

      if (allPassed) {
        await adminClient
          .from("plans")
          .update({ status: "completed" })
          .eq("id", challenge.plan_id);
      }
    } else {
      // Update challenge to in_progress if it was pending
      if (challenge.status === "pending") {
        await adminClient
          .from("challenges")
          .update({ status: "in_progress" })
          .eq("id", challenge_id);
      }
    }

    return NextResponse.json({
      submission: updatedSubmission,
      passed: evaluation.passed,
      feedback: evaluation.feedback,
      score: evaluation.score,
    });
  } catch (error) {
    console.error("Error in submission evaluation:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "An error occurred" },
      { status: 500 }
    );
  }
}
