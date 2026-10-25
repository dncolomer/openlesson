/**
 * Dump the raw session corpus: sessions, proof of work pointers, embedding
 * metadata, and optional xAI file bytes. Embeddings are listed, not treated
 * as the source of truth.
 *
 * Usage:
 *   vite-node --config vitest.config.ts scripts/backup-session-corpus.ts -- --out ./corpus --target=staging
 *   vite-node --config vitest.config.ts scripts/backup-session-corpus.ts -- --out ./corpus --download-files
 */
import fs from "node:fs";
import path from "node:path";
import { connectTarget } from "./db-connection.mjs";
import { getFileContentResponse, isXaiFileId } from "../lib/xai-files";
import {
  buildSessionCorpusRecord,
  type CorpusProofOfWork,
} from "../lib/session-corpus";
import { parseSessionKind } from "../lib/core-data-model";

function argValue(flag: string): string | null {
  const index = process.argv.indexOf(flag);
  if (index < 0) return null;
  return process.argv[index + 1] || null;
}

function hasFlag(flag: string): boolean {
  return process.argv.includes(flag);
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

async function main() {
  const outDir = path.resolve(argValue("--out") || "./session-corpus-backup");
  const target = argValue("--target") === "prod" ? "prod" : "staging";
  const downloadFiles = hasFlag("--download-files");
  fs.mkdirSync(outDir, { recursive: true });

  const { client } = await connectTarget(target);
  try {
    const sessionCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'sessions'
    `);
    const sessionColNames = new Set(sessionCols.rows.map((row: { column_name: string }) => row.column_name));
    const embeddingCols = await client.query(`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'workspace_flow_embeddings'
    `);
    const embeddingColNames = new Set(
      embeddingCols.rows.map((row: { column_name: string }) => row.column_name),
    );

    const kindSelect = sessionColNames.has("kind")
      ? "COALESCE(kind, 'learn') AS kind"
      : "'learn'::text AS kind";
    const resultSelect = sessionColNames.has("result") ? "result" : "NULL::jsonb AS result";
    const fieldSelect = sessionColNames.has("field_model")
      ? "field_model"
      : "NULL::jsonb AS field_model";
    const sessionIdOnEmb = embeddingColNames.has("session_id")
      ? "session_id"
      : "NULL::uuid AS session_id";

    const sessions = await client.query(`
      SELECT id, status, user_id, metadata, created_at, ended_at,
             ${kindSelect}, ${resultSelect}, ${fieldSelect}
      FROM public.sessions
      ORDER BY created_at ASC
    `);

    const pow = await client.query(`
      SELECT id, session_id, proof_of_work_type, tool_name, tool_action,
             mime_type, file_name, xai_file_id, timestamp_ms, metadata
      FROM public.workspace_proof_of_work
      ORDER BY timestamp_ms ASC
    `);

    const embeddings = await client.query(`
      SELECT id, run_id, flow_kind, embedding_model_id, dim, created_at, raw, ${sessionIdOnEmb}
      FROM public.workspace_flow_embeddings
      ORDER BY created_at ASC
    `);

    const powBySession = new Map<string, CorpusProofOfWork[]>();
    for (const row of pow.rows) {
      const sessionId = String(row.session_id || "");
      if (!sessionId) continue;
      const meta = asRecord(row.metadata);
      const list = powBySession.get(sessionId) || [];
      list.push({
        id: String(row.id),
        type: String(row.proof_of_work_type || "tool"),
        toolName: row.tool_name ?? null,
        toolAction: row.tool_action ?? null,
        mimeType: row.mime_type ?? null,
        fileName: row.file_name ?? null,
        xaiFileId: row.xai_file_id ?? null,
        timestampMs: Number(row.timestamp_ms) || 0,
        metadata: meta,
        payload: typeof meta.transcript_snapshot === "string" ? meta.transcript_snapshot : null,
      });
      powBySession.set(sessionId, list);
    }

    const embBySession = new Map<string, Array<{
      id: string;
      embeddingModelId: string;
      family: "learn" | "calibrate" | "verify";
      dim: number;
      createdAt: string | null;
    }>>();
    const genModelBySession = new Map<string, unknown>();
    for (const row of embeddings.rows) {
      const sessionId = String(row.session_id || row.run_id || "");
      if (!sessionId) continue;
      const family = parseSessionKind(row.flow_kind) ?? "learn";
      const list = embBySession.get(sessionId) || [];
      list.push({
        id: String(row.id),
        embeddingModelId: String(row.embedding_model_id || ""),
        family,
        dim: Number(row.dim) || 0,
        createdAt: row.created_at ? String(row.created_at) : null,
      });
      embBySession.set(sessionId, list);
      const raw = asRecord(row.raw);
      if (raw.genModel && !genModelBySession.has(sessionId)) {
        genModelBySession.set(sessionId, raw.genModel);
      }
    }

    const jsonlPath = path.join(outDir, "sessions.jsonl");
    const stream = fs.createWriteStream(jsonlPath);
    const allFileIds = new Set<string>();
    let written = 0;
    for (const row of sessions.rows) {
      const sessionId = String(row.id);
      const record = buildSessionCorpusRecord({
        sessionId,
        kind: row.kind,
        fieldModel: row.field_model ?? null,
        genModel: genModelBySession.get(sessionId) ?? null,
        result: row.result,
        proofOfWork: powBySession.get(sessionId) || [],
        embeddings: embBySession.get(sessionId) || [],
      });
      for (const id of record.xaiFileIds) allFileIds.add(id);
      stream.write(`${JSON.stringify(record)}\n`);
      written += 1;
    }
    stream.end();
    await new Promise<void>((resolve, reject) => {
      stream.on("finish", () => resolve());
      stream.on("error", reject);
    });

    const manifest = {
      target,
      written_at: new Date().toISOString(),
      session_count: written,
      proof_of_work_count: pow.rows.length,
      xai_file_id_count: allFileIds.size,
      download_files: downloadFiles,
    };
    fs.writeFileSync(path.join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
    fs.writeFileSync(
      path.join(outDir, "xai-file-ids.json"),
      JSON.stringify([...allFileIds], null, 2),
    );

    if (downloadFiles) {
      const filesDir = path.join(outDir, "xai-files");
      fs.mkdirSync(filesDir, { recursive: true });
      let downloaded = 0;
      let skipped = 0;
      for (const fileId of allFileIds) {
        if (!isXaiFileId(fileId)) {
          skipped += 1;
          continue;
        }
        const res = await getFileContentResponse(fileId);
        if (!res.ok) {
          skipped += 1;
          continue;
        }
        const buf = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(path.join(filesDir, fileId), buf);
        downloaded += 1;
      }
      fs.writeFileSync(
        path.join(outDir, "download-report.json"),
        JSON.stringify({ downloaded, skipped }, null, 2),
      );
    }

    console.log(
      JSON.stringify(
        { ok: true, outDir, session_count: written, xai_file_ids: allFileIds.size },
        null,
        2,
      ),
    );
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
