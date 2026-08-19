import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

export function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

export function readGridOpsSurface(): string {
  const dir = join(ROOT, "lib/workspace-grid-ops");
  const parts = [readRepo("app/api/workspace/grid-ops/route.ts")];
  for (const name of readdirSync(dir).sort()) {
    if (name.endsWith(".ts")) parts.push(readFileSync(join(dir, name), "utf8"));
  }
  return parts.join("\n");
}

export function readMapGridSurface(): string {
  const dir = join(ROOT, "components/block-skill-grid");
  const parts = [readRepo("components/BlockSkillGrid.tsx")];
  for (const name of readdirSync(dir).sort()) {
    if (name.endsWith(".ts") || name.endsWith(".tsx")) {
      parts.push(readFileSync(join(dir, name), "utf8"));
    }
  }
  return parts.join("\n");
}

export function readSessionViewSurface(): string {
  const dir = join(ROOT, "components/session-view");
  const parts = [readRepo("components/SessionView.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as SessionView extracts land.
  }
  return parts.join("\n");
}

export function readWorkspaceViewSurface(): string {
  const dir = join(ROOT, "components/workspace-view");
  const parts = [readRepo("components/WorkspaceView.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as WorkspaceView extracts land.
  }
  return parts.join("\n");
}

export function readMcpSurface(): string {
  const dir = join(ROOT, "lib/pow-api/mcp-tools");
  const parts = [readRepo("lib/pow-api/mcp-proof-of-work-server.ts")];
  for (const name of readdirSync(dir).sort()) {
    if (name.endsWith(".ts")) parts.push(readFileSync(join(dir, name), "utf8"));
  }
  return parts.join("\n");
}

export function readTapScoreSurface(): string {
  const dir = join(ROOT, "components/tap-score");
  const parts = [readRepo("components/TapScoreClient.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as TAP extracts land.
  }
  return parts.join("\n");
}

export function readExerciseTapSurface(): string {
  const dir = join(ROOT, "components/exercise-tap");
  const parts = [readRepo("components/ExerciseTapClient.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as Exercise TAP extracts land.
  }
  return parts.join("\n");
}

export function readKnowledgePanelSurface(): string {
  const dir = join(ROOT, "components/knowledge-panel");
  const parts = [readRepo("components/KnowledgeConfigTrajectoryPanel.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as Knowledge panel extracts land.
  }
  return parts.join("\n");
}
