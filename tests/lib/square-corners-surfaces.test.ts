/**
 * Workspace / ILE / TAP box chrome uses 90° corners (no rounded-* box radii).
 * Scans the shipped files those products actually import/mount.
 */
import { describe, expect, it } from "vitest";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, join, relative } from "node:path";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-0626b15ef450/implementer";

const ENTRY_DIRS = ["app/workspace", "app/ile", "app/tap", "app/learn"];

const ENTRY_SHELLS = [
  "components/WorkspaceView.tsx",
  "components/SessionView.tsx",
  "components/ExerciseTapClient.tsx",
  "components/TapScoreClient.tsx",
  "components/IleGuestSessionClient.tsx",
  "components/AyclWorkspaceView.tsx",
  "components/BlockSkillGrid.tsx",
  "components/ChapterMapPanel.tsx",
];

const SKIP_BASENAMES = new Set([
  "Footer.tsx",
  "Navbar.tsx",
  "LandingNav.tsx",
  "BrandLogo.tsx",
]);

/** Public Map of Knowledge pages are out of scope even if Knowledge embeds them. */
const SKIP_REL_PREFIXES = ["components/MapOfKnowledge"];

const MUST_INCLUDE = [
  "components/RabbitHoleExpandModal.tsx",
  "components/BlockGoalsPanel.tsx",
  "components/SimulationCollectionAddButton.tsx",
  "components/IntegrationQuickAccess.tsx",
  "components/MultiBlockDagCanvas.tsx",
  "components/MultiBlockDagPreview.tsx",
];

const BOX_ROUNDED_RE = /rounded-(sm|md|lg|xl|2xl|3xl)\b/;
const INLINE_RADIUS_RE =
  /border(?:(?:Top|Bottom)?(?:Left|Right))?Radius\s*:\s*(?:(\d+(?:\.\d+)?)|(["'`])(\d+(?:\.\d+)?)(?:px)?\2)/;
const FROM_RE = /from\s+["']([^"']+)["']/g;

function walkDir(dir: string, out: string[] = []): string[] {
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return out;
  }
  for (const name of entries) {
    if (name === "node_modules" || name.startsWith(".")) continue;
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walkDir(p, out);
    else if (/\.(tsx|ts)$/.test(name)) out.push(p);
  }
  return out;
}

function resolveExisting(base: string): string | null {
  const tries = [
    base,
    `${base}.tsx`,
    `${base}.ts`,
    join(base, "index.tsx"),
    join(base, "index.ts"),
  ];
  for (const t of tries) {
    if (existsSync(t) && statSync(t).isFile()) return t;
  }
  return null;
}

function resolveSpecifier(fromFile: string, spec: string): string | null {
  if (spec.startsWith("@/")) return resolveExisting(join(ROOT, spec.slice(2)));
  if (spec.startsWith(".")) return resolveExisting(join(dirname(fromFile), spec));
  return null;
}

function shouldEnqueue(fromFile: string, resolved: string): boolean {
  const rel = relative(ROOT, resolved);
  if (SKIP_BASENAMES.has(rel.split("/").pop() || "")) return false;
  if (SKIP_REL_PREFIXES.some((p) => rel.startsWith(p))) return false;
  if (rel.startsWith("components/") || rel.startsWith("app/workspace") ||
      rel.startsWith("app/ile") || rel.startsWith("app/tap") ||
      rel.startsWith("app/learn")) {
    return true;
  }
  // One hop into lib class helpers (e.g. TAP thought-button classes).
  const fromRel = relative(ROOT, fromFile);
  if (
    rel.startsWith("lib/") &&
    (fromRel.startsWith("components/") || fromRel.startsWith("app/"))
  ) {
    return true;
  }
  return false;
}

function collectMountedSurfaceFiles(): string[] {
  const queue: string[] = [];
  for (const rel of ENTRY_DIRS) {
    walkDir(join(ROOT, rel), queue);
  }
  for (const rel of ENTRY_SHELLS) {
    const p = join(ROOT, rel);
    if (existsSync(p)) queue.push(p);
  }

  const seen = new Set<string>();
  const files: string[] = [];
  while (queue.length) {
    const abs = queue.pop()!;
    if (seen.has(abs)) continue;
    seen.add(abs);
    const rel = relative(ROOT, abs);
    if (SKIP_BASENAMES.has(rel.split("/").pop() || "")) continue;
    if (SKIP_REL_PREFIXES.some((p) => rel.startsWith(p))) continue;
    if (!/\.(tsx|ts)$/.test(abs)) continue;
    files.push(abs);
    let src = "";
    try {
      src = readFileSync(abs, "utf8");
    } catch {
      continue;
    }
    FROM_RE.lastIndex = 0;
    let m: RegExpExecArray | null;
    const fromLib = rel.startsWith("lib/");
    while ((m = FROM_RE.exec(src))) {
      const resolved = resolveSpecifier(abs, m[1]);
      if (!resolved) continue;
      if (!resolved.startsWith(ROOT)) continue;
      if (resolved.includes("node_modules")) continue;
      if (fromLib && relative(ROOT, resolved).startsWith("lib/")) continue;
      if (!shouldEnqueue(abs, resolved)) continue;
      queue.push(resolved);
    }
  }
  return files.sort();
}

function scanLineHits(rel: string, line: string, lineNo: number): string[] {
  const stripped = line.replaceAll("rounded-full", "").replaceAll("rounded-none", "");
  const hits: string[] = [];
  const box = stripped.match(BOX_ROUNDED_RE);
  if (box) hits.push(`${rel}:${lineNo} ${box[0]}`);
  const radius = stripped.match(INLINE_RADIUS_RE);
  if (radius) {
    const n = Number(radius[1] || radius[3]);
    if (Number.isFinite(n) && n > 0) hits.push(`${rel}:${lineNo} borderRadius=${n}`);
  }
  return hits;
}

describe("workspace / ILE / TAP square corners", () => {
  it("mounted product UI has no rounded-sm/md/lg/xl box radii", () => {
    const files = collectMountedSurfaceFiles();
    const rels = files.map((f) => relative(ROOT, f));
    expect(files.length).toBeGreaterThan(40);
    for (const must of MUST_INCLUDE) {
      expect(rels, `mount tree missing ${must}`).toContain(must);
    }

    const hits: string[] = [];
    let roundedNoneCount = 0;
    for (const abs of files) {
      const rel = relative(ROOT, abs);
      const src = readFileSync(abs, "utf8");
      if (src.includes("rounded-none")) roundedNoneCount += 1;
      src.split("\n").forEach((line, i) => {
        hits.push(...scanLineHits(rel, line, i + 1));
      });
    }

    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(
      join(SCRATCH, "square-corners-surfaces.log"),
      [
        "files_scanned=" + files.length,
        "rounded_none_files=" + roundedNoneCount,
        "must_include=" + MUST_INCLUDE.join(","),
        "hits=" + hits.length,
        hits.length ? hits.join("\n") : "none",
      ].join("\n") + "\n",
      "utf8",
    );

    expect(hits, hits.slice(0, 30).join("\n")).toEqual([]);
    expect(roundedNoneCount).toBeGreaterThan(20);
  });
});
