#!/usr/bin/env node

import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");
const csvPath = process.argv[2]
  ? path.resolve(process.cwd(), process.argv[2])
  : path.join(projectRoot, "scripts/data/rabbit-hole/rabbit-hole-questions-trees.csv");

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
if (!serviceRoleKey) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function parseCsv(input) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < input.length; i += 1) {
    const char = input[i];
    const next = input[i + 1];

    if (char === '"') {
      if (inQuotes && next === '"') {
        field += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      row.push(field);
      field = "";
    } else if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") i += 1;
      row.push(field);
      if (row.some((value) => value.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }

  row.push(field);
  if (row.some((value) => value.trim() !== "")) rows.push(row);
  return rows;
}

function recordsFromCsv(input) {
  const rows = parseCsv(input);
  if (rows.length < 2) return [];

  const headers = rows[0].map((header) => header.trim());
  return rows.slice(1).map((row, index) => {
    const record = { __line: index + 2 };
    headers.forEach((header, headerIndex) => {
      record[header] = row[headerIndex]?.trim() ?? "";
    });
    return record;
  });
}

function requireField(record, field) {
  const value = record[field];
  if (!value) throw new Error(`Missing ${field} on CSV line ${record.__line}`);
  return value;
}

function toInteger(record, field) {
  const value = Number.parseInt(requireField(record, field), 10);
  if (!Number.isInteger(value)) throw new Error(`Invalid ${field} on CSV line ${record.__line}`);
  return value;
}

function branchOrder(branchType) {
  const normalized = branchType.trim().toLowerCase();
  if (normalized === "top") return 0;
  if (normalized === "left") return 1;
  if (normalized === "right") return 2;
  const parsed = Number.parseInt(branchType, 10);
  return Number.isInteger(parsed) ? parsed : 0;
}

function buildImportPlan(records) {
  const tops = new Map();

  for (const record of records) {
    const topId = requireField(record, "top_id");
    const qId = requireField(record, "q_id");
    const depth = toInteger(record, "depth");
    const question = requireField(record, "question_text");
    const topQuestion = requireField(record, "top_question");

    if (!tops.has(topId)) {
      tops.set(topId, {
        sourceTopId: topId,
        question: topQuestion,
        discipline: record.discipline || null,
        sort_order: Number.parseInt(topId, 10) || tops.size + 1,
        nodes: [],
      });
    }

    tops.get(topId).nodes.push({
      source_q_id: qId,
      source_parent_q_id: record.parent_q_id || null,
      question,
      depth,
      branch_order: branchOrder(record.branch_type || ""),
    });
  }

  for (const top of tops.values()) {
    const rootNodes = top.nodes.filter((node) => node.depth === 0 || !node.source_parent_q_id);
    if (rootNodes.length !== 1) {
      throw new Error(`Top ${top.sourceTopId} must have exactly one root node; found ${rootNodes.length}`);
    }
  }

  return [...tops.values()].sort((a, b) => a.sort_order - b.sort_order);
}

async function assertOk(result, action) {
  if (result.error) throw new Error(`${action}: ${result.error.message}`);
  return result.data;
}

async function main() {
  const csv = await readFile(csvPath, "utf8");
  const plan = buildImportPlan(recordsFromCsv(csv));

  console.log(`Importing ${plan.length} Rabbit Hole top questions from ${csvPath}`);

  // This script is intended for pre-launch resets, so clear play history before
  // replacing question content.
  await assertOk(
    await supabase.from("rabbit_hole_plays").delete().not("id", "is", null),
    "Failed to delete existing Rabbit Hole plays",
  );
  await assertOk(
    await supabase.from("rabbit_hole_top_questions").delete().not("id", "is", null),
    "Failed to delete existing Rabbit Hole questions",
  );

  for (const top of plan) {
    const insertedTop = await assertOk(
      await supabase
        .from("rabbit_hole_top_questions")
        .insert({ question: top.question, discipline: top.discipline, sort_order: top.sort_order, active: true })
        .select("id")
        .single(),
      `Failed to insert top question ${top.sourceTopId}`,
    );

    const sourceToUuid = new Map();
    const depths = [...new Set(top.nodes.map((node) => node.depth))].sort((a, b) => a - b);

    for (const depth of depths) {
      const nodes = top.nodes
        .filter((node) => node.depth === depth)
        .sort((a, b) => a.branch_order - b.branch_order || Number(a.source_q_id) - Number(b.source_q_id));
      const rows = nodes.map((node) => {
        const parentId = node.source_parent_q_id ? sourceToUuid.get(node.source_parent_q_id) : null;
        if (node.source_parent_q_id && !parentId) {
          throw new Error(`Missing parent ${node.source_parent_q_id} for node ${node.source_q_id} in top ${top.sourceTopId}`);
        }
        return {
          top_question_id: insertedTop.id,
          parent_id: parentId,
          question: node.question,
          depth: node.depth,
          branch_order: node.branch_order,
        };
      });

      const insertedNodes = await assertOk(
        await supabase.from("rabbit_hole_nodes").insert(rows).select("id"),
        `Failed to insert depth ${depth} nodes for top ${top.sourceTopId}`,
      );

      if ((insertedNodes?.length ?? 0) !== nodes.length) {
        throw new Error(`Inserted ${insertedNodes?.length ?? 0} of ${nodes.length} depth ${depth} nodes for top ${top.sourceTopId}`);
      }

      nodes.forEach((node, index) => sourceToUuid.set(node.source_q_id, insertedNodes[index].id));
    }

    console.log(`Inserted top ${top.sourceTopId}: ${top.nodes.length} nodes`);
  }

  console.log("Rabbit Hole question import complete.");
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
