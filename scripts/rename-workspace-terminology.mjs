#!/usr/bin/env node
/**
 * One-shot bulk rename: workspaces/blocks → workspaces/blocks in app source.
 * Excludes historical migrations and .next.
 */
import fs from "fs";
import path from "path";

const ROOT = path.resolve(import.meta.dirname, "..");

const SKIP_DIRS = new Set([".next", "node_modules", ".git"]);
const SKIP_FILE_RE = /supabase\/migrations\/0\d{2}_/;

const REPLACEMENTS = [
  ["workspaces!inner", "workspaces!inner"],
  ["workspaces", "workspaces"],
  ["block_sessions", "block_sessions"],
  ["block_id", "block_id"],
  ["blocks", "blocks"],
  ["workspace_files", "workspace_files"],
  ["/api/workspaces/", "/api/workspaces/"],
  ["/api/workspace/", "/api/workspace/"],
  ["/api/admin/workspaces/", "/api/admin/workspaces/"],
  ["/api/group-workspace/", "/api/group-workspace/"],
  ["/api/agent/workspace", "/api/agent/workspace"],
  ["get_personal_workspace_analytics", "get_personal_workspace_analytics"],
  ["get_org_workspace_analytics", "get_org_workspace_analytics"],
  ["get_group_workspace_sessions", "get_group_workspace_sessions"],
  ["getWorkspaces", "getWorkspaces"],
  ["getBlocks", "getBlocks"],
  ["getWorkspaceById", "getWorkspaceById"],
  ["workspaceBlocks", "workspaceBlocks"],
  ["learning_blocks", "workspace_blocks"],
  ["Workspace", "Workspace"],
  ["Block", "Block"],
  ["workspaceChat", "workspaceChat"],
  ["workspacesPage", "workspacesPage"],
  ["noWorkspacesYet", "noWorkspacesYet"],
  ["createWorkspaceDesc", "createWorkspaceDesc"],
  ["createWorkspace", "createWorkspace"],
  ["workspaces", "workspaces"],
  ["original_workspace_id", "original_workspace_id"],
  ["is_agent_workspace", "is_agent_workspace"],
  ["workspace_id", "workspace_id"],
  ["workspaceId", "workspaceId"],
  ["target_workspace_id", "target_workspace_id"],
  ["p_workspace_id", "p_workspace_id"],
  ["workspaceTitle", "workspaceTitle"],
  ["workspaceFiles", "workspaceFiles"],
  ["reloadWorkspaces", "reloadWorkspaces"],
  ["filteredWorkspaces", "filteredWorkspaces"],
  ["publicWorkspaces", "publicWorkspaces"],
  ["showArchivedWorkspaces", "showArchivedWorkspaces"],
  ["archivingWorkspaceId", "archivingWorkspaceId"],
  ["workspaceSearch", "workspaceSearch"],
  ["workspacePage", "workspacePage"],
  ["workspacePageSize", "workspacePageSize"],
  ["block", "block"],
  ["blocks", "blocks"],
  ["block_title", "block_title"],
  ["block_id", "block_id"],
  ["blockTitle", "blockTitle"],
  ["blockId", "blockId"],
  ["total_blocks", "total_blocks"],
  ["completed_blocks", "completed_blocks"],
  ["avgBlocksKpi", "avgBlocksKpi"],
  ["workspacesBreadcrumb", "workspacesBreadcrumb"],
  ["noWorkspacesFound", "noWorkspacesFound"],
  ["searchWorkspaces", "searchWorkspaces"],
  ["allWorkspaces", "allWorkspaces"],
  ["noMatchingWorkspaces", "noMatchingWorkspaces"],
  ["latestWorkspace", "latestWorkspace"],
];

const EXT_RE = /\.(ts|tsx|js|mjs|json|md|py)$/;

function walk(dir, files = []) {
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIRS.has(ent.name)) continue;
    const full = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(full, files);
    else if (EXT_RE.test(ent.name) && !SKIP_FILE_RE.test(full.replace(ROOT + path.sep, ""))) files.push(full);
  }
  return files;
}

let changed = 0;
for (const file of walk(ROOT)) {
  let text = fs.readFileSync(file, "utf8");
  const orig = text;
  for (const [from, to] of REPLACEMENTS) {
    text = text.split(from).join(to);
  }
  if (text !== orig) {
    fs.writeFileSync(file, text);
    changed++;
  }
}
console.log(`Updated ${changed} files`);