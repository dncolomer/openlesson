import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { WorkspaceView } from "@/components/WorkspaceView";
import { getRandomWorkspaceCoverImage } from "@/lib/workspace-image";

interface PageProps {
  params: Promise<{
    id: string;
    slug: string;
  }>;
}

async function getPlan(workspaceId: string) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    return null;
  }

  const cookieStore = await cookies();
  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {},
      },
    }
  );

  const { data: plan, error } = await supabase
    .from("workspaces")
    .select("*, profiles:author_id(username)")
    .eq("id", workspaceId)
    .or("is_public.eq.true,is_group.eq.true")
    .single();

  if (error || !plan) {
    return null;
  }

  if (plan.profiles) {
    plan.author_username = plan.profiles.username;
  }

  const { data: nodes } = await supabase
    .from("blocks")
    .select("*")
    .eq("workspace_id", workspaceId);

  return { plan, nodes: nodes || [] };
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id, slug } = await params;
  
  const result = await getPlan(id);
  
  if (!result) {
    return {
      title: "Plan Not Found - openLesson",
    };
  }

  const { plan } = result;
  const title = plan.title || plan.root_topic;
  const description = plan.description || `A workspace by @${plan.author_username || "anonymous"} on openLesson`;

  const ogImage = await getRandomWorkspaceCoverImage() || `/p/${id}/${slug}/opengraph-image`;

  return {
    title: `${title} - openLesson`,
    description,
    openGraph: {
      title: `${title} - openLesson`,
      description,
      type: "website",
      images: [
        {
          url: ogImage,
          width: 1200,
          height: 630,
          alt: title,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - openLesson`,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicPlanPage({ params }: PageProps) {
  const { id, slug } = await params;
  
  const result = await getPlan(id);
  
  if (!result) {
    notFound();
  }

  return <WorkspaceView initialPlan={result.plan} initialNodes={result.nodes} />;
}
