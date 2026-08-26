import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TapbenchWorkspaceDetail } from "@/components/TapbenchWorkspaceDetail";
import {
  getTapbenchBenchmarkTask,
  presentTapbenchTaskIntro,
} from "@/lib/tapbench/catalog";
import { loadTapbenchTaskGoals } from "@/lib/tapbench/goals";
import { tryCreateTapbenchAdminClient } from "@/lib/tapbench/http";
import { listTapbenchPublicRegions } from "@/lib/tapbench/region";

export const dynamic = "force-dynamic";

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const supabase = tryCreateTapbenchAdminClient();
  const found = await getTapbenchBenchmarkTask(supabase, id);
  const goals = found ? await loadTapbenchTaskGoals(supabase, id) : null;
  const intro = found
    ? presentTapbenchTaskIntro(found.task, goals?.workspace_goal ?? found.workspace_goal)
    : { name: "TAPBench", description: "TAPBench workspace." };
  return {
    title: `${intro.name} · TAPBench`,
    description: intro.description || "TAPBench workspace.",
  };
}

export default async function TapbenchWorkspacePage({ params }: PageProps) {
  const { id } = await params;
  const workspaceId = typeof id === "string" ? id.trim() : "";
  if (!workspaceId) notFound();
  const supabase = tryCreateTapbenchAdminClient();
  const found = await getTapbenchBenchmarkTask(supabase, workspaceId);
  if (!found) notFound();
  const [goals, regions] = await Promise.all([
    loadTapbenchTaskGoals(supabase, workspaceId),
    listTapbenchPublicRegions(supabase, [workspaceId]),
  ]);
  const intro = presentTapbenchTaskIntro(
    found.task,
    goals?.workspace_goal ?? found.workspace_goal,
  );
  return (
    <TapbenchWorkspaceDetail
      name={intro.name}
      description={intro.description}
      regions={regions}
    />
  );
}
