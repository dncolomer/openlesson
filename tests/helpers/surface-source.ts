import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(__dirname, "../..");

export function readRepo(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

export function readExcalidrawSurface(): string {
  const dir = join(ROOT, "components/excalidraw-canvas");
  const parts = [readRepo("components/ExcalidrawCanvas.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as Excalidraw extracts land.
  }
  return parts.join("\n");
}

export function readDashboardSurface(): string {
  const dir = join(ROOT, "components/dashboard");
  const parts = [readRepo("app/dashboard/page.tsx")];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory is created as dashboard extracts land.
  }
  return parts.join("\n");
}

export function readSessionViewSurface(): string {
  const dir = join(ROOT, "components/session-view");
  const parts: string[] = [];
  try {
    for (const name of readdirSync(dir).sort()) {
      if (name.endsWith(".ts") || name.endsWith(".tsx")) {
        parts.push(readFileSync(join(dir, name), "utf8"));
      }
    }
  } catch {
    // Directory optional.
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

/** Exercise TAP UI was deleted. Callers should assert the files are gone. */
export const EXERCISE_TAP_DELETED_PATHS = [
  "components/ExerciseTapClient.tsx",
  "components/exercise-tap/ExerciseTapShell.tsx",
  "components/exercise-tap/exercise-tap-phases.tsx",
] as const;
