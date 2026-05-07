import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
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

// xAI Responses currently allows at most 20 file attachments per request.
// Reserve one slot for the generated performance summary JSON.
const MAX_PERFORMANCE_ARTIFACT_FILE_REFS = 19;

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

    // Get the plan to check ownership and group status
    const { data: plan } = await supabase
      .from("learning_plans")
      .select("id, user_id, root_topic, title, is_group")
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
    // - Group plan participants (non-owner): see only themselves
    // - Regular users: see only themselves
    let canSeeAllUsers = isOwner || isOrgAdmin;

    if (message.trim() === "/debug") {
      if (!canSeeAllUsers) {
        return NextResponse.json({ error: "Not authorized for performance debug" }, { status: 403 });
      }

      const debugClient = createAdminClient();
      const debug = await fetchPerformanceDebug(debugClient, planId, user.id, isOwner, profile?.organization_id, isOrgAdmin);
      return NextResponse.json({ response: formatPerformanceDebug(debug), debug, fileIds: [] });
    }

    // If this is the first message (no fileIds), we need to fetch and upload data
    let activeFileIds = fileIds;
    let usersContext = "";

    if (activeFileIds.length === 0) {
      const dataClient = canSeeAllUsers ? createAdminClient() : supabase;

      // Fetch session data based on access level
      const performanceData = await fetchPerformanceData(
        dataClient,
        planId,
        plan.root_topic || plan.title || "Learning Plan",
        user.id,
        canSeeAllUsers,
        isOwner,
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
        const sessionIds = performanceData.users.flatMap(userData => userData.sessions.map(session => session.id));
        const artifactFileIds = await fetchSessionArtifactFileIds(dataClient, sessionIds);
        activeFileIds = [uploadResult.file_id, ...artifactFileIds.slice(0, MAX_PERFORMANCE_ARTIFACT_FILE_REFS)];
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
      model: "grok-4.3",
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

async function fetchSessionArtifactFileIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  sessionIds: string[],
): Promise<string[]> {
  const uniqueSessionIds = Array.from(new Set(sessionIds));
  if (uniqueSessionIds.length === 0) return [];

  const artifactTables = [
    "session_transcript",
    "session_analysis",
    "session_tool",
    "session_eeg",
    "session_facial",
    "session_screenshots",
  ];

  const results = await Promise.all(
    artifactTables.map(table =>
      supabase
        .from(table)
        .select("session_id, xai_file_id, created_at")
        .in("session_id", uniqueSessionIds)
        .not("xai_file_id", "is", null)
        .neq("xai_file_id", "_empty")
        .order("created_at", { ascending: false })
        .limit(10)
    )
  );

  const fileIds: string[] = [];
  for (const result of results) {
    if (result.error) {
      console.error("[performance-chat] Artifact file lookup error:", result.error);
      continue;
    }

    for (const row of result.data || []) {
      if (row.xai_file_id && !fileIds.includes(row.xai_file_id)) {
        fileIds.push(row.xai_file_id);
      }
    }
  }

  return fileIds;
}

async function fetchPerformanceDebug(
  supabase: ReturnType<typeof createAdminClient>,
  planId: string,
  requestingUserId: string,
  isOwner: boolean,
  organizationId?: string | null,
  isOrgAdmin?: boolean,
) {
  const { data: plan } = await supabase
    .from("learning_plans")
    .select("id, user_id, title, root_topic, is_group, is_public")
    .eq("id", planId)
    .single();

  const { data: pnsRows, error: pnsError } = await supabase
    .from("plan_node_sessions")
    .select("session_id, user_id, plan_node_id")
    .eq("plan_id", planId);

  const { data: nodeRows, error: nodeError } = await supabase
    .from("plan_nodes")
    .select("id, session_id, title")
    .eq("plan_id", planId);

  const directSessionIds = (nodeRows || [])
    .map(row => row.session_id)
    .filter(Boolean) as string[];

  const { data: metadataRows, error: metadataError } = await supabase
    .from("sessions")
    .select("id, user_id, status, metadata")
    .filter("metadata->>plan_id", "eq", planId);

  const allSessionIds = Array.from(new Set([
    ...(pnsRows || []).map(row => row.session_id),
    ...directSessionIds,
    ...(metadataRows || []).map(row => row.id),
  ]));

  const { data: sessions, error: sessionsError } = allSessionIds.length > 0
    ? await supabase
      .from("sessions")
      .select("id, user_id, status, created_at, metadata")
      .in("id", allSessionIds)
    : { data: [], error: null };

  return {
    plan_id: planId,
    requester_id: requestingUserId,
    is_owner: isOwner,
    is_org_admin: !!isOrgAdmin,
    organization_id: organizationId || null,
    plan,
    counts: {
      plan_node_sessions: pnsRows?.length || 0,
      plan_nodes: nodeRows?.length || 0,
      plan_nodes_with_session_id: directSessionIds.length,
      metadata_sessions: metadataRows?.length || 0,
      unique_session_ids: allSessionIds.length,
      readable_sessions_by_admin_client: sessions?.length || 0,
    },
    errors: {
      plan_node_sessions: pnsError?.message || null,
      plan_nodes: nodeError?.message || null,
      metadata_sessions: metadataError?.message || null,
      sessions: sessionsError?.message || null,
    },
    sample_session_ids: allSessionIds.slice(0, 10),
  };
}

function formatPerformanceDebug(debug: Awaited<ReturnType<typeof fetchPerformanceDebug>>): string {
  return `Performance debug for plan \`${debug.plan_id}\`:

- is_owner: ${debug.is_owner}
- is_org_admin: ${debug.is_org_admin}
- plan.is_group: ${debug.plan?.is_group ?? "unknown"}
- plan.owner_matches_requester: ${debug.plan?.user_id === debug.requester_id}
- plan_node_sessions: ${debug.counts.plan_node_sessions}
- plan_nodes: ${debug.counts.plan_nodes}
- plan_nodes_with_session_id: ${debug.counts.plan_nodes_with_session_id}
- metadata_sessions: ${debug.counts.metadata_sessions}
- unique_session_ids_found: ${debug.counts.unique_session_ids}
- readable_sessions_by_admin_client: ${debug.counts.readable_sessions_by_admin_client}

Errors:

\`\`\`json
${JSON.stringify(debug.errors, null, 2)}
\`\`\`

Sample session ids:

\`\`\`json
${JSON.stringify(debug.sample_session_ids, null, 2)}
\`\`\``;
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
  isOwner: boolean,
  organizationId?: string | null,
  isOrgAdmin?: boolean,
): Promise<PerformanceDataPayload> {
  return fetchLinkedPlanPerformanceData(
    supabase, planId, planTitle, requestingUserId, canSeeAllUsers, isOwner, organizationId, isOrgAdmin
  );
}

/**
 * Fetch performance data from every supported plan-session link path. Plans can
 * be linked through plan_node_sessions, plan_nodes.session_id, or session
 * metadata depending on which start flow created the session.
 */
async function fetchLinkedPlanPerformanceData(
  supabase: Awaited<ReturnType<typeof createClient>>,
  planId: string,
  planTitle: string,
  requestingUserId: string,
  canSeeAllUsers: boolean,
  isOwner: boolean,
  organizationId?: string | null,
  isOrgAdmin?: boolean,
): Promise<PerformanceDataPayload> {

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let rows: any[] = [];

  if (canSeeAllUsers) {
    const { data: links, error: linkError } = await supabase
      .from("plan_node_sessions")
      .select("session_id, user_id, plan_node_id")
      .eq("plan_id", planId);

    if (linkError) {
      console.error("[performance-chat] Plan link lookup error:", linkError);
    }

    const { data: directNodes, error: directNodesError } = await supabase
      .from("plan_nodes")
      .select("id, title, session_id")
      .eq("plan_id", planId);

    if (directNodesError) {
      console.error("[performance-chat] Plan node lookup error:", directNodesError);
    }

    // Sessions created through newer start paths also carry the plan link in
    // metadata. Use it as a final source so missing join rows do not hide data.
    const { data: metadataSessions, error: metadataSessionsError } = await supabase
      .from("sessions")
      .select("id, user_id, metadata")
      .filter("metadata->>plan_id", "eq", planId)
      .order("created_at", { ascending: false });

    if (metadataSessionsError) {
      console.error("[performance-chat] Metadata-session fallback error:", metadataSessionsError);
    }

    const sessionNodeMap = new Map<string, string | null>();
    for (const link of links || []) {
      sessionNodeMap.set(link.session_id, link.plan_node_id);
    }
    for (const node of directNodes || []) {
      if (node.session_id) sessionNodeMap.set(node.session_id, node.id);
    }
    for (const session of metadataSessions || []) {
      const metadata = session.metadata as Record<string, unknown> | null;
      const nodeId = typeof metadata?.plan_node_id === "string" ? metadata.plan_node_id : null;
      if (nodeId || !sessionNodeMap.has(session.id)) {
        sessionNodeMap.set(session.id, nodeId);
      }
    }

    const sessionIds = Array.from(sessionNodeMap.keys());
    const nodeIds = Array.from(new Set(Array.from(sessionNodeMap.values()).filter(Boolean))) as string[];

    const { data: sessions, error: sessionsError } = sessionIds.length > 0
      ? await supabase
        .from("sessions")
        .select("id, problem, status, duration_ms, created_at, report, user_id")
        .in("id", sessionIds)
        .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (sessionsError) {
      console.error("[performance-chat] Plan sessions lookup error:", sessionsError);
    }

    const userIds = Array.from(new Set((sessions || []).map(session => session.user_id)));
    const { data: profiles } = userIds.length > 0
      ? await supabase
        .from("profiles")
        .select("id, username, organization_id")
        .in("id", userIds)
      : { data: [] };

    const { data: nodes } = nodeIds.length > 0
      ? await supabase
        .from("plan_nodes")
        .select("id, title")
        .in("id", nodeIds)
      : { data: [] };

    const profileMap = new Map((profiles || []).map(profile => [profile.id, profile]));
    const nodeTitleMap = new Map((nodes || []).map(node => [node.id, node.title]));

    rows = (sessions || []).flatMap(session => {
      const profile = profileMap.get(session.user_id);
      if (!isOwner && isOrgAdmin && organizationId && profile?.organization_id !== organizationId) {
        return [];
      }

      const nodeId = sessionNodeMap.get(session.id) || null;
      return [{
        session_id: session.id,
        user_id: session.user_id,
        username: profile?.username || "unknown",
        problem: session.problem,
        status: session.status,
        duration_ms: session.duration_ms,
        report: session.report,
        created_at: session.created_at,
        ended_at: null,
        node_id: nodeId,
        node_title: nodeId ? nodeTitleMap.get(nodeId) || null : null,
      }];
    });
  } else {
    // Restricted path: only sessions owned by the requester, discovered through
    // the same link sources used for aggregate plan performance.
    const { data: links, error: linkError } = await supabase
      .from("plan_node_sessions")
      .select("session_id, plan_node_id")
      .eq("plan_id", planId)
      .eq("user_id", requestingUserId);

    if (linkError) {
      console.error("[performance-chat] Plan link lookup error:", linkError);
    }

    const { data: directNodes, error: directNodesError } = await supabase
      .from("plan_nodes")
      .select("id, title, session_id")
      .eq("plan_id", planId);

    if (directNodesError) {
      console.error("[performance-chat] Plan node lookup error:", directNodesError);
    }

    const { data: metadataSessions, error: metadataSessionsError } = await supabase
      .from("sessions")
      .select("id, user_id, metadata")
      .filter("metadata->>plan_id", "eq", planId)
      .eq("user_id", requestingUserId)
      .order("created_at", { ascending: false });

    if (metadataSessionsError) {
      console.error("[performance-chat] Metadata-session fallback error:", metadataSessionsError);
    }

    const sessionNodeMap = new Map<string, string | null>();
    for (const link of links || []) {
      sessionNodeMap.set(link.session_id, link.plan_node_id);
    }
    for (const node of directNodes || []) {
      if (node.session_id) sessionNodeMap.set(node.session_id, node.id);
    }
    for (const session of metadataSessions || []) {
      const metadata = session.metadata as Record<string, unknown> | null;
      const nodeId = typeof metadata?.plan_node_id === "string" ? metadata.plan_node_id : null;
      if (nodeId || !sessionNodeMap.has(session.id)) {
        sessionNodeMap.set(session.id, nodeId);
      }
    }

    const sessionIds = Array.from(sessionNodeMap.keys());
    const nodeIds = Array.from(new Set(Array.from(sessionNodeMap.values()).filter(Boolean))) as string[];

    const { data: sessions, error: sessionsError } = sessionIds.length > 0
      ? await supabase
        .from("sessions")
        .select("id, problem, status, duration_ms, created_at, report, user_id")
        .in("id", sessionIds)
        .eq("user_id", requestingUserId)
        .order("created_at", { ascending: false })
      : { data: [], error: null };

    if (sessionsError) {
      console.error("[performance-chat] Plan sessions lookup error:", sessionsError);
    }

    const { data: nodes } = nodeIds.length > 0
      ? await supabase
        .from("plan_nodes")
        .select("id, title")
        .in("id", nodeIds)
      : { data: [] };

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", requestingUserId)
      .single();

    const nodeMap = new Map((nodes || []).map(n => [n.id, n.title]));

    rows = (sessions || []).map(s => ({
      session_id: s.id,
      user_id: s.user_id,
      username: profile?.username || "unknown",
      problem: s.problem,
      status: s.status,
      duration_ms: s.duration_ms,
      report: s.report,
      created_at: s.created_at,
      ended_at: null,
      node_id: sessionNodeMap.get(s.id),
      node_title: nodeMap.get(sessionNodeMap.get(s.id) || "") || null,
    }));
  }

  // Group rows by user
  const userMap = new Map<string, UserPerformanceData>();

  for (const row of rows) {
    const uid = row.user_id;
    if (!userMap.has(uid)) {
      userMap.set(uid, {
        username: row.username || "unknown",
        user_id: uid,
        sessions: [],
        summary: { total_sessions: 0, completed_sessions: 0, total_duration_minutes: 0 },
      });
    }
    const userData = userMap.get(uid)!;
    const durationMinutes = Math.round((row.duration_ms || 0) / 60000);
    const isCompleted = row.status === "completed" || row.status === "ended_by_tutor";

    userData.sessions.push({
      id: row.session_id,
      node_title: row.node_title || null,
      problem: row.problem,
      status: row.status,
      duration_minutes: durationMinutes,
      started_at: row.created_at,
      report: row.report,
    });

    userData.summary.total_sessions++;
    if (isCompleted) userData.summary.completed_sessions++;
    userData.summary.total_duration_minutes += durationMinutes;
  }

  return {
    plan_title: planTitle,
    plan_id: planId,
    generated_at: new Date().toISOString(),
    users: Array.from(userMap.values()),
  };
}
