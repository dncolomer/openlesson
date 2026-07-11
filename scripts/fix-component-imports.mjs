#!/usr/bin/env node
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");
const REPLACEMENTS = [
  ["@/components/PlanView", "@/components/WorkspaceView"],
  ["@/components/PlanChat", "@/components/WorkspaceChat"],
  ["@/components/PlanFilesTab", "@/components/WorkspaceFilesTab"],
  ["@/components/PlanResourcesPanel", "@/components/WorkspaceResourcesPanel"],
  ["@/components/PlanModeSelect", "@/components/WorkspaceModeSelect"],
  ["@/components/MobilePlanTab", "@/components/MobileWorkspaceTab"],
  ["@/components/CommunityPlansCarousel", "@/components/CommunityWorkspacesCarousel"],
  ["@/components/CommunityPlans", "@/components/CommunityWorkspaces"],
  ["@/lib/plan-image", "@/lib/workspace-image"],
  ["<PlanView", "<WorkspaceView"],
  ["PlanView />", "WorkspaceView />"],
  ["export function PlanView", "export function WorkspaceView"],
  ["function PlanView(", "function WorkspaceView("],
  ["export default function PlanView", "export default function WorkspaceView"],
  ["<PlanChat", "<WorkspaceChat"],
  ["<PlanFilesTab", "<WorkspaceFilesTab"],
  ["<PlanResourcesPanel", "<WorkspaceResourcesPanel"],
  ["<PlanModeSelect", "<WorkspaceModeSelect"],
  ["<MobilePlanTab", "<MobileWorkspaceTab"],
  ["/admin/plans/", "/admin/workspaces/"],
  ["href={`/admin/plans/", "href={`/admin/workspaces/"],
  ["getPlanMeta", "getWorkspaceMeta"],
  ["getRandomPlanCoverImage", "getRandomWorkspaceCoverImage"],
  ["export async function generateMetadata", "export async function generateMetadata"],
];

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if ([".next", "node_modules", ".git"].includes(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (/\.(ts|tsx)$/.test(ent.name)) files.push(full);
  }
  return files;
}

for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  for (const [a, b] of REPLACEMENTS) text = text.split(a).join(b);
  if (text !== orig) fs.writeFileSync(file, text);
}
console.log("done");