import { Metadata } from "next";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { WorkspaceView } from "@/components/WorkspaceView";

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
    .select("title, root_topic, cover_image_url, description")
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
  // Private workspace UI has no dedicated OG route; use composed root card (not raw aesthetics).
  const images = [
    {
      url: "/opengraph-image",
      width: 1200,
      height: 630,
      alt: title,
    },
  ];

  return {
    title: `${title} - Uncertain Systems`,
    description,
    openGraph: {
      title: `${title} - Uncertain Systems`,
      description,
      type: "website",
      images,
    },
    twitter: {
      card: "summary_large_image",
      title: `${title} - Uncertain Systems`,
      description,
      images: images.map((i) => i.url),
    },
  };
}

export default function WorkspacePage() {
  return <WorkspaceView />;
}