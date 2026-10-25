import { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { WorkspaceView } from "@/components/WorkspaceView";
import { standardShareSocialMetadata } from "@/lib/og/standard";
import { noMapWorkspaceDashboardHref } from "@/lib/workspace-kind";

interface PageProps {
  params: Promise<{ id: string }>;
}

async function getWorkspaceMeta(workspaceId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!supabaseUrl || !supabaseAnonKey) return null;

  const cookieStore = await cookies();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: { getAll() { return cookieStore.getAll(); }, setAll() {} },
  });

  const { data } = await supabase
    .from("workspaces")
    .select("title, root_topic, cover_image_url, description, workspace_kind")
    .eq("id", workspaceId)
    .single();

  return data;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const plan = await getWorkspaceMeta(id);

  if (!plan) {
    return { title: "Workspace - Uncertain Systems" };
  }

  const title = plan.title || plan.root_topic || "Workspace";
  const description = plan.description || "A workspace on Uncertain Systems";
  // Page SEO stays workspace-specific; social share is the unsys standard.
  const social = standardShareSocialMetadata();

  return {
    title: `${title} - Uncertain Systems`,
    description,
    openGraph: social.openGraph,
    twitter: social.twitter,
  };
}

export default async function WorkspacePage({ params }: PageProps) {
  const { id } = await params;
  const row = await getWorkspaceMeta(id);
  const href = noMapWorkspaceDashboardHref(row?.workspace_kind);
  if (href) redirect(href);
  return <WorkspaceView />;
}