import { createClient } from "@/lib/supabase/server";
import type { ContributionDay } from "@/lib/contributions";

export interface PublicProfilePlan {
  id: string;
  title: string;
  root_topic: string;
  description: string | null;
  cover_image_url: string | null;
  created_at: string;
  remix_count: number;
}

export interface PublicProfileActivity {
  id: string;
  type: "plan_published" | "session_completed";
  title: string;
  occurred_at: string;
}

export interface PublicProfileData {
  id: string;
  username: string;
  display_name: string | null;
  bio: string | null;
  avatar_url: string | null;
  created_at: string;
  public_activity_enabled: boolean;
  public_stats_enabled: boolean;
  public_session_titles_enabled: boolean;
  stats: {
    public_plans: number;
    completed_sessions: number | null;
    learning_minutes: number | null;
  };
  contribution_days: ContributionDay[];
  topics: Array<{ name: string; count: number }>;
  plans: PublicProfilePlan[];
  activity: PublicProfileActivity[];
}

function normalizeUsername(username: string) {
  return username.trim().replace(/^@/, "").toLowerCase();
}

export function profileDisplayName(profile: Pick<PublicProfileData, "display_name" | "username">) {
  return profile.display_name?.trim() || `@${profile.username}`;
}

export function profileDescription(profile: Pick<PublicProfileData, "bio" | "username" | "stats">) {
  if (profile.bio?.trim()) return profile.bio.trim();
  return `Follow @${profile.username}'s public learning activity, plans, and progress on openLesson.`;
}

export async function getPublicProfile(username: string): Promise<PublicProfileData | null> {
  const normalizedUsername = normalizeUsername(username);
  if (!normalizedUsername) return null;

  const supabase = await createClient();

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("id, username, display_name, bio, avatar_url, created_at, public_activity_enabled, public_stats_enabled, public_session_titles_enabled")
    .ilike("username", normalizedUsername)
    .eq("profile_visibility", "public")
    .single();

  if (error || !profile?.username) return null;

  const { data: plans } = await supabase
    .from("learning_plans")
    .select("id, title, root_topic, description, cover_image_url, created_at, remix_count")
    .eq("author_id", profile.id)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(12);

  const publicPlans = (plans || []).map((plan) => ({
    id: plan.id,
    title: plan.title || plan.root_topic,
    root_topic: plan.root_topic,
    description: plan.description,
    cover_image_url: plan.cover_image_url,
    created_at: plan.created_at,
    remix_count: plan.remix_count || 0,
  }));

  const { data: sessionSummary } = await supabase.rpc("get_public_profile_session_summary", {
    profile_username: normalizedUsername,
  });

  const completedSessions = typeof sessionSummary?.completed_sessions === "number" ? sessionSummary.completed_sessions : null;
  const learningMinutes = typeof sessionSummary?.learning_minutes === "number" ? sessionSummary.learning_minutes : null;
  const sessionActivity: PublicProfileActivity[] = Array.isArray(sessionSummary?.activity)
    ? sessionSummary.activity.map((item: any) => ({
        id: item.id,
        type: "session_completed" as const,
        title: item.title,
        occurred_at: item.occurred_at,
      }))
    : [];
  const contributionDays: ContributionDay[] = Array.isArray(sessionSummary?.daily_minutes)
    ? sessionSummary.daily_minutes.map((item: any) => ({
        date: item.date,
        minutes: item.minutes || 0,
      }))
    : [];

  const topicCounts = new Map<string, number>();
  for (const plan of publicPlans) {
    const topic = plan.root_topic || plan.title;
    if (topic) topicCounts.set(topic, (topicCounts.get(topic) || 0) + 1);
  }

  const planActivity: PublicProfileActivity[] = publicPlans.slice(0, 8).map((plan) => ({
    id: plan.id,
    type: "plan_published",
    title: plan.title,
    occurred_at: plan.created_at,
  }));

  const activity = [...planActivity, ...sessionActivity]
    .sort((a, b) => new Date(b.occurred_at).getTime() - new Date(a.occurred_at).getTime())
    .slice(0, 10);

  return {
    id: profile.id,
    username: profile.username,
    display_name: profile.display_name,
    bio: profile.bio,
    avatar_url: profile.avatar_url,
    created_at: profile.created_at,
    public_activity_enabled: profile.public_activity_enabled,
    public_stats_enabled: profile.public_stats_enabled,
    public_session_titles_enabled: profile.public_session_titles_enabled,
    stats: {
      public_plans: publicPlans.length,
      completed_sessions: completedSessions,
      learning_minutes: learningMinutes,
    },
    contribution_days: contributionDays,
    topics: Array.from(topicCounts.entries())
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 8),
    plans: publicPlans,
    activity,
  };
}
