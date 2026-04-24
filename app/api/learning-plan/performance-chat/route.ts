import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { uploadFileToXAI } from "@/lib/xai-files";
import { callXaiResponses, ResponsesInputMessage } from "@/lib/xai-client";

export const runtime = "nodejs";
export const maxDuration = 120;

interface SessionData {
  id: string;
  node_title: string | null;
  problem: string;
  status: string;
  duration_minutes: number;
  started_at: string;
  report: string | null;
}

interface UserPerformanceData {
  username: string;
  user_id: string;
  sessions: SessionData[];
  summary: {
    total_sessions: number;
    completed_sessions: number;
    total_duration_minutes: number;
  };
}

interface PerformanceDataPayload {
  plan_title: string;
  plan_id: string;
  generated_at: string;
  users: UserPerformanceData[];
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const body = await req.json();
    const { planId, message, conversationHistory = [], fileIds = [] } = body;

    if (!planId) {
      return NextResponse.json({ error: "planId is required" }, { status: 400 });
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: "message is required" }, { status: 400 });
    }

    // Get user's profile to check permissions
    const { data: profile } = await supabase
      .from("profiles")
      .select("organization_id, is_org_admin, is_admin, username")
      .eq("id", user.id)
      .single();

    // Get the plan to check ownership
    const { data: plan } = await supabase
      .from("learning_plans")
      .select("id, user_id, root_topic, title")
      .eq("id", planId)
      .single();

    if (!plan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    const isOwner = plan.user_id === user.id;
    const isOrgAdmin = profile?.is_org_admin || profile?.is_admin;

    // Determine access level
    // - Plan owners: see all users on their plan
    // - Org admins: see all users in their org
    // - Regular users: see only themselves
    let canSeeAllUsers = isOwner || isOrgAdmin;

    // If this is the first message (no fileIds), we need to fetch and upload data
    let activeFileIds = fileIds;
    let usersContext = "";

    if (activeFileIds.length === 0) {
      // Fetch session data based on access level
      const performanceData = await fetchPerformanceData(
        supabase,
        planId,
        plan.root_topic || plan.title || "Learning Plan",
        user.id,
        canSeeAllUsers,
        profile?.organization_id,
        isOrgAdmin
      );

      if (performanceData.users.length === 0) {
        return NextResponse.json({
          response: "No session data found for this plan yet. Once users complete sessions, you'll be able to ask questions about their performance here.",
          fileIds: [],
          users: [],
        });
      }

      // Build users context string for the system prompt
      usersContext = performanceData.users
        .map(u => `@${u.username} (${u.summary.total_sessions} sessions, ${u.summary.completed_sessions} completed)`)
        .join(", ");

      // Upload the performance data as a file to xAI
      const dataJson = JSON.stringify(performanceData, null, 2);
      const fileName = `performance-data-${planId}-${Date.now()}.json`;
      
      try {
        const uploadResult = await uploadFileToXAI(
          fileName,
          "application/json",
          Buffer.from(dataJson).toString("base64")
        );
        activeFileIds = [uploadResult.file_id];
      } catch (uploadError) {
        console.error("[performance-chat] Failed to upload file to xAI:", uploadError);
        return NextResponse.json(
          { error: "Failed to prepare performance data" },
          { status: 500 }
        );
      }
    }

    // Build the conversation for xAI Responses API
    const systemInstructions = buildSystemInstructions(canSeeAllUsers, usersContext, profile?.username);

    // Build input messages
    const inputMessages: ResponsesInputMessage[] = [];

    // Add conversation history
    for (const msg of conversationHistory) {
      inputMessages.push({
        role: msg.role as "user" | "assistant",
        content: msg.content,
      });
    }

    // Add current message with file references
    inputMessages.push({
      role: "user",
      content: [
        { type: "input_text", text: message },
        ...activeFileIds.map((fileId: string) => ({ type: "input_file" as const, file_id: fileId })),
      ],
    });

    // Call xAI Responses API
    const result = await callXaiResponses({
      model: "grok-4-0709",
      instructions: systemInstructions,
      input: inputMessages,
      temperature: 0.7,
      maxOutputTokens: 4096,
      fetchTimeout: 120000,
    });

    if (!result.success) {
      console.error("[performance-chat] xAI API error:", result.error);
      return NextResponse.json(
        { error: result.error || "Failed to get AI response" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      response: result.text,
      fileIds: activeFileIds,
    });

  } catch (error) {
    console.error("[performance-chat] Error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Internal server error" },
      { status: 500 }
    );
  }
}

function buildSystemInstructions(canSeeAllUsers: boolean, usersContext: string, currentUsername?: string): string {
  const baseInstructions = `You are an AI assistant analyzing learning session performance data for an educational platform called OpenLesson.

Your role is to help users understand performance patterns, identify areas for improvement, and provide actionable insights based on session reports.

The session data is provided in a JSON file attached to this conversation. Each user has:
- A list of sessions with their reports (markdown format containing detailed feedback)
- Session metadata (duration, status, timestamps)
- Summary statistics

When analyzing performance:
1. Reference specific details from session reports to support your insights
2. Look for patterns across sessions (improving/declining performance, recurring challenges)
3. Be constructive and encouraging while being honest about areas needing improvement
4. Compare users fairly if asked, focusing on objective metrics and observations
5. Suggest specific, actionable improvements when appropriate

Format your responses in markdown for readability. Use headers, bullet points, and emphasis where appropriate.`;

  if (canSeeAllUsers && usersContext) {
    return `${baseInstructions}

You have access to performance data for the following users: ${usersContext}

You can answer questions about individual users, compare users, identify group trends, or provide aggregate insights.`;
  } else {
    return `${baseInstructions}

You only have access to performance data for the current user${currentUsername ? ` (@${currentUsername})` : ""}. Focus on providing personalized insights and improvement suggestions based on their session history.`;
  }
}

async function fetchPerformanceData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  planTitle: string,
  requestingUserId: string,
  canSeeAllUsers: boolean,
  organizationId?: string | null,
  isOrgAdmin?: boolean
): Promise<PerformanceDataPayload> {
  // Build the query to get sessions linked to this plan via plan_nodes
  let query = supabase
    .from("sessions")
    .select(`
      id,
      problem,
      status,
      duration_ms,
      created_at,
      report,
      user_id,
      plan_nodes!inner (
        plan_id,
        title
      ),
      profiles!inner (
        id,
        username,
        organization_id
      )
    `)
    .eq("plan_nodes.plan_id", planId)
    .order("created_at", { ascending: false });

  // Apply access control filters
  if (!canSeeAllUsers) {
    // Regular user: only their own sessions
    query = query.eq("user_id", requestingUserId);
  } else if (isOrgAdmin && organizationId) {
    // Org admin: only users in their organization
    query = query.eq("profiles.organization_id", organizationId);
  }
  // Plan owner: no additional filter needed (sees all users on their plan)

  const { data: sessions, error } = await query;

  if (error) {
    console.error("[performance-chat] Error fetching sessions:", error);
    return {
      plan_title: planTitle,
      plan_id: planId,
      generated_at: new Date().toISOString(),
      users: [],
    };
  }

  // Group sessions by user
  const userMap = new Map<string, UserPerformanceData>();

  for (const session of sessions || []) {
    const userId = session.user_id;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = session.profiles as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const planNode = Array.isArray(session.plan_nodes) ? session.plan_nodes[0] : session.plan_nodes as any;
    
    if (!userMap.has(userId)) {
      userMap.set(userId, {
        username: profile?.username || "unknown",
        user_id: userId,
        sessions: [],
        summary: {
          total_sessions: 0,
          completed_sessions: 0,
          total_duration_minutes: 0,
        },
      });
    }

    const userData = userMap.get(userId)!;
    const durationMinutes = Math.round((session.duration_ms || 0) / 60000);
    const isCompleted = session.status === "completed" || session.status === "ended_by_tutor";

    userData.sessions.push({
      id: session.id,
      node_title: planNode?.title || null,
      problem: session.problem,
      status: session.status,
      duration_minutes: durationMinutes,
      started_at: session.created_at,
      report: session.report,
    });

    userData.summary.total_sessions++;
    if (isCompleted) {
      userData.summary.completed_sessions++;
    }
    userData.summary.total_duration_minutes += durationMinutes;
  }

  return {
    plan_title: planTitle,
    plan_id: planId,
    generated_at: new Date().toISOString(),
    users: Array.from(userMap.values()),
  };
}
