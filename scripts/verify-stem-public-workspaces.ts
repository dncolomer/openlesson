/**
 * Verify public admin-owned STEM workspaces + subdiscipline knowledge regions.
 *
 * SAFETY: default target is staging. Production only with --target=prod.
 *
 * Usage:
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/verify-stem-public-workspaces.ts
 *   ./node_modules/vite-node/vite-node.mjs --config vitest.config.ts \
 *     scripts/verify-stem-public-workspaces.ts --target=prod
 */

import { connectTarget } from "./db-connection.mjs";
import {
  STEM_PUBLIC_CATALOG_MARKER,
  STEM_PUBLIC_FIELDS,
  assertStemCatalogComplete,
  stemFieldNotesMarker,
} from "../lib/demo/stem-public-workspaces";
import {
  KNOWLEDGE_CONFIG_DIM,
  KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID,
  isKnowledgeConfigVector,
} from "../lib/knowledge-config";
import { parseSaasTechDemoSeedTarget } from "./saas-tech-demo-target";

async function main() {
  const target = parseSaasTechDemoSeedTarget(process.argv);
  console.log(`[verify-stem-public] target=${target} marker=${STEM_PUBLIC_CATALOG_MARKER}`);
  if (target === "prod") {
    console.log("[verify-stem-public] PRODUCTION READ: intentional --target=prod");
  }

  const catalog = assertStemCatalogComplete();
  console.log(
    `[verify-stem-public] catalog expectation fields=${catalog.fieldCount} min_regions=${catalog.minRegionsPerField}`,
  );

  const { client, via } = await connectTarget(target);
  console.log(`[verify-stem-public] connected target=${target} via ${via}`);

  const failures: string[] = [];
  try {
    for (const field of STEM_PUBLIC_FIELDS) {
      const marker = stemFieldNotesMarker(field.key);
      const ws = await client.query(
        `SELECT w.id, w.title, w.is_public, w.notes, w.user_id, w.status,
                u.email AS owner_email, p.is_admin, p.is_org_admin
         FROM public.workspaces w
         JOIN auth.users u ON u.id = w.user_id
         JOIN public.profiles p ON p.id = w.user_id
         WHERE w.notes ILIKE $1
         ORDER BY w.created_at DESC
         LIMIT 1`,
        [`%${marker}%`],
      );

      if (!ws.rows[0]) {
        failures.push(`field ${field.key}: missing workspace with marker ${marker}`);
        continue;
      }

      const row = ws.rows[0];
      const workspaceId = String(row.id);
      const title = String(row.title);
      const isPublic = Boolean(row.is_public);
      const isAdmin = Boolean(row.is_admin);
      const ownerEmail = String(row.owner_email);

      console.log(
        `[verify] ${field.key} workspace_id=${workspaceId} title=${title} is_public=${isPublic} owner=${ownerEmail} is_admin=${isAdmin}`,
      );

      if (title !== field.title) {
        failures.push(`field ${field.key}: title mismatch got "${title}" want "${field.title}"`);
      }
      if (!isPublic) {
        failures.push(`field ${field.key}: is_public must be true`);
      }
      if (!isAdmin) {
        failures.push(`field ${field.key}: owner ${ownerEmail} is not is_admin`);
      }
      if (!String(row.notes || "").includes(STEM_PUBLIC_CATALOG_MARKER)) {
        failures.push(`field ${field.key}: notes missing catalog marker`);
      }

      const regions = await client.query(
        `SELECT id, name, embedding_model_id, dim, centroid, subject_count, mean_radius
         FROM public.custom_verification_models
         WHERE workspace_id = $1
         ORDER BY name`,
        [workspaceId],
      );
      const regionCount = regions.rows.length;
      console.log(`[verify] ${field.key} regions=${regionCount}`);

      if (regionCount < 3) {
        failures.push(
          `field ${field.key}: expected ≥3 knowledge regions, got ${regionCount}`,
        );
      }
      if (regionCount < field.subdisciplines.length) {
        failures.push(
          `field ${field.key}: expected ${field.subdisciplines.length} regions, got ${regionCount}`,
        );
      }

      const expectedNames = new Set(
        field.subdisciplines.map((s) => s.regionName.toLowerCase()),
      );
      const gotNames = new Set(
        regions.rows.map((r) => String(r.name).toLowerCase()),
      );
      for (const name of expectedNames) {
        if (!gotNames.has(name)) {
          failures.push(`field ${field.key}: missing region name "${name}"`);
        }
      }

      for (const r of regions.rows) {
        const modelId = String(r.embedding_model_id);
        const dim = Number(r.dim);
        let centroid = r.centroid;
        if (typeof centroid === "string") {
          try {
            centroid = JSON.parse(centroid);
          } catch {
            failures.push(`field ${field.key} region ${r.name}: centroid not JSON`);
            continue;
          }
        }
        if (modelId !== KNOWLEDGE_CONFIG_EMBEDDING_MODEL_ID) {
          failures.push(
            `field ${field.key} region ${r.name}: embedding_model_id ${modelId}`,
          );
        }
        if (dim !== KNOWLEDGE_CONFIG_DIM) {
          failures.push(`field ${field.key} region ${r.name}: dim ${dim}`);
        }
        if (!isKnowledgeConfigVector(centroid as number[], KNOWLEDGE_CONFIG_DIM)) {
          failures.push(
            `field ${field.key} region ${r.name}: centroid not valid knowledgecfg vector`,
          );
        }
        if (Number(r.subject_count) < 1) {
          failures.push(`field ${field.key} region ${r.name}: subject_count < 1`);
        }
      }

      const blocks = await client.query(
        `SELECT id, title, is_start FROM public.blocks WHERE workspace_id = $1 ORDER BY title`,
        [workspaceId],
      );
      const blockCount = blocks.rows.length;
      console.log(`[verify] ${field.key} blocks=${blockCount}`);
      if (blockCount < field.subdisciplines.length) {
        failures.push(
          `field ${field.key}: expected ≥${field.subdisciplines.length} blocks (1 per region), got ${blockCount}`,
        );
      }
      if (blockCount !== regionCount) {
        failures.push(
          `field ${field.key}: block count ${blockCount} != region count ${regionCount}`,
        );
      }
      const blockTitles = new Set(
        blocks.rows.map((b) => String(b.title).toLowerCase()),
      );
      for (const sub of field.subdisciplines) {
        if (!blockTitles.has(sub.regionName.toLowerCase())) {
          failures.push(
            `field ${field.key}: missing block titled like region "${sub.regionName}"`,
          );
        }
      }
      const startCount = blocks.rows.filter((b) => Boolean(b.is_start)).length;
      if (startCount < 1) {
        failures.push(`field ${field.key}: expected ≥1 start block`);
      }
    }

    if (failures.length > 0) {
      console.error("[verify-stem-public] FAILED:");
      for (const f of failures) console.error(`  - ${f}`);
      process.exitCode = 1;
      return;
    }

    console.log(
      `[verify-stem-public] PASS target=${target} fields=${STEM_PUBLIC_FIELDS.length} all public admin-owned with regions`,
    );
  } finally {
    try {
      await client.end();
    } catch {
      /* ignore */
    }
  }
}

main().catch((err) => {
  console.error("[verify-stem-public] FATAL:", err instanceof Error ? err.message : err);
  process.exitCode = 1;
});
