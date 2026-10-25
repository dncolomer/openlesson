/**
 * Rebuild Path embeddings from a corpus JSONL dump. Does not read stored vectors.
 *
 * Usage:
 *   vite-node --config vitest.config.ts scripts/reembed-session-corpus.ts -- --in ./corpus/sessions.jsonl --out ./corpus/reembedded.jsonl
 */
import fs from "node:fs";
import path from "node:path";
import readline from "node:readline";
import { reembedSessionCorpus, type SessionCorpusRecord } from "../lib/session-corpus";
import { parseSessionKind } from "../lib/core-data-model";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

async function main() {
  const inPath = path.resolve(argValue("--in") || "./session-corpus-backup/sessions.jsonl");
  const outPath = path.resolve(argValue("--out") || "./session-corpus-backup/reembedded.jsonl");
  if (!fs.existsSync(inPath)) {
    throw new Error(`Missing corpus file: ${inPath}`);
  }
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  const input = fs.createReadStream(inPath);
  const output = fs.createWriteStream(outPath);
  const rl = readline.createInterface({ input, crlfDelay: Infinity });
  let count = 0;
  for await (const line of rl) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const record = JSON.parse(trimmed) as SessionCorpusRecord;
    const family = parseSessionKind(record.kind) ?? "learn";
    const embedded = reembedSessionCorpus(record, family);
    output.write(
      `${JSON.stringify({
        sessionId: record.sessionId,
        kind: family,
        embedding_model_id: embedded.embedding_model_id,
        dim: embedded.dim,
        vector: embedded.vector,
        vector_path_text: embedded.vector_path_text,
      })}\n`,
    );
    count += 1;
  }
  output.end();
  await new Promise<void>((resolve, reject) => {
    output.on("finish", () => resolve());
    output.on("error", reject);
  });
  console.log(JSON.stringify({ ok: true, count, outPath }, null, 2));
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
