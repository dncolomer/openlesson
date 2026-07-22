import { notFound } from "next/navigation";
import { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { WorkspaceView } from "@/components/WorkspaceView";

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
    .select("*")
    .eq("id", workspaceId)
    .eq("is_public", true)
    .single();

  if (error || !plan) {
    return null;
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
      title: "Plan Not Found - Uncertain Systems",
    };
  }

  const { plan } = result;
  const title = plan.title || plan.root_topic;
  const description = plan.description || `A workspace on Uncertain Systems`;
  // Composed OG (aesthetics + dynamic title) — never raw cover-only assets.
  const ogImage = `/p/${id}/${slug}/opengraph-image`;

  return {
    title: `${title} - Uncertain Systems`,
    description,
    openGraph: {
      title: `${title} - Uncertain Systems`,
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
      title: `${title} - Uncertain Systems`,
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
