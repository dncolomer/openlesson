import { NextResponse } from "next/server";
import { jsonError } from "@/lib/api-error-envelope";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import type { RabbitHoleNode } from "@/lib/rabbit-hole";

type DbNode = { id: string; top_question_id: string; parent_id: string | null; question: string; depth: number; branch_order: number };

function buildTree(nodes: DbNode[], topQuestion: string): RabbitHoleNode | null {
  if (!nodes.length) return { id: "root", question: topQuestion, depth: 0, children: [] };

  const byId = new Map<string, RabbitHoleNode>();
  for (const node of nodes) byId.set(node.id, { id: node.id, question: node.question, depth: node.depth, children: [] });
  for (const node of nodes) {
    if (node.parent_id) byId.get(node.parent_id)?.children.push(byId.get(node.id)!);
  }
  const root = nodes.find((node) => !node.parent_id) ?? nodes.find((node) => node.depth === 0);
  const rootNode = root ? byId.get(root.id) ?? null : null;

  if (rootNode && rootNode.children.length > 0) return rootNode;

  const levels = new Map<number, DbNode[]>();
  for (const node of nodes) {
    const level = levels.get(node.depth) ?? [];
    level.push(node);
    levels.set(node.depth, level);
  }

  for (const level of levels.values()) {
    level.sort((a, b) => a.branch_order - b.branch_order || a.id.localeCompare(b.id));
  }

  for (let depth = 1; depth <= Math.max(...nodes.map((node) => node.depth)); depth += 1) {
    const children = levels.get(depth) ?? [];
    const parents = levels.get(depth - 1) ?? [];
    children.forEach((child, childIndex) => {
      const parent = parents[Math.floor(childIndex / 2)];
      const childNode = byId.get(child.id);
      const parentNode = parent ? byId.get(parent.id) : null;
      if (childNode && parentNode && !parentNode.children.some((existing) => existing.id === childNode.id)) {
        parentNode.children.push(childNode);
      }
    });
  }

  const fallbackRoot = (levels.get(0) ?? [])[0];
  return fallbackRoot ? byId.get(fallbackRoot.id) ?? null : { id: "root", question: topQuestion, depth: 0, children: [] };
}

export async function GET() {
  const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

  const { data: questions, error } = await supabase
    .from("rabbit_hole_top_questions")
    .select("id, question, discipline, sort_order")
    .eq("active", true)
    .order("sort_order", { ascending: true })
    .limit(100);

  if (error) return jsonError(500, "Failed to load questions");

  const ids = (questions ?? []).map((question) => question.id);
  const { data: nodes } = ids.length
    ? await supabase.from("rabbit_hole_nodes").select("id, top_question_id, parent_id, question, depth, branch_order").in("top_question_id", ids).order("branch_order", { ascending: true })
    : { data: [] as DbNode[] };

  return NextResponse.json({
    questions: (questions ?? []).map((question) => ({
      id: question.id,
      question: question.question,
      discipline: question.discipline,
      tree: buildTree((nodes ?? []).filter((node) => node.top_question_id === question.id), question.question),
    })),
  });
}
