/**
 * Run flowcfg-v1-d96 distances, ablations, a provisional expert region, and 2D coords.
 *
 * Usage:
 *   vite-node --config vitest.config.ts scripts/flow-embedding-harness.ts
 *   vite-node --config vitest.config.ts scripts/flow-embedding-harness.ts -- --in ./corpus/sessions.jsonl --out ./corpus/harness.json
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { parseProjectionAlgorithmId } from "../lib/knowledge-config/project-2d";
import { recoverFlowEmbeddingRaw } from "../lib/flow-embedding";
import {
  corpusRecordToHarnessCase,
  syntheticFlowHarnessCases,
  type FlowHarnessCase,
} from "../lib/flow-embedding-fixtures";
import { runFlowEmbeddingHarness } from "../lib/flow-embedding-harness";
import { corpusRecordToFlowRaw, type SessionCorpusRecord } from "../lib/session-corpus";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

async function loadCorpusCases(inPath: string): Promise<FlowHarnessCase[]> {
  const input = fs.createReadStream(inPath);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  const cases: FlowHarnessCase[] = [];
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const record = JSON.parse(trimmed) as SessionCorpusRecord & {
      label?: string;
      problem?: string;
      role?: string;
    };
    const raw = recoverFlowEmbeddingRaw(record) ?? corpusRecordToFlowRaw(record);
    cases.push(corpusRecordToHarnessCase(record, raw));
  }
  return cases;
}

async function main() {
  const inPath = argValue("--in");
  const outPath = path.resolve(argValue("--out") || "./session-corpus-backup/flow-embedding-harness.json");
  const cases = inPath
    ? await loadCorpusCases(path.resolve(inPath))
    : hasFlag("--synthetic") || !inPath
      ? syntheticFlowHarnessCases()
      : [];
  if (!cases.length) {
    throw new Error("No harness cases. Pass --synthetic or --in sessions.jsonl");
  }
  const report = runFlowEmbeddingHarness({
    cases,
    projection: parseProjectionAlgorithmId(argValue("--projection") || "pca"),
    regionName: argValue("--region-name") || "provisional expert region",
    regionProblem: argValue("--region-problem") || undefined,
  });
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, `${JSON.stringify(report, null, 2)}\n`);
  const regionScores = report.region?.scores.map((row) => ({
    id: row.id,
    role: row.role,
    in_region: row.in_region,
    cosine: Number(row.cosine_similarity.toFixed(4)),
    l2: Number(row.l2_distance.toFixed(4)),
  }));
  console.log(
    JSON.stringify(
      {
        ok: true,
        algorithm_id: report.algorithm_id,
        cases: report.cases.length,
        pairwise: report.pairwise.length,
        determinism: report.ablations.determinism,
        silent: report.ablations.path_equals_path_text_when_silent,
        region: report.region
          ? {
              name: report.region.name,
              cosine_threshold: report.region.spec.cosine_threshold,
              scores: regionScores,
            }
          : null,
        outPath,
      },
      null,
      2,
    ),
  );
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
