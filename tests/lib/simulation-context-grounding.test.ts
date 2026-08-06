/**
 * Simulation grounding: pure builders + sample context must use workspace
 * goal/notes, files, external links, and map inventory — not title/description alone.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildGroundedDialogueQuestion,
  buildGroundedExerciseItem,
  buildSimulationSamplesUserPrompt,
  isMetaLearningFluff,
  practiceAllSubstanceLayers,
  practiceDomainSubstance,
  practiceMaterialSubstance,
} from "@/lib/practice-item-builders";
import {
  buildSimulationSamplePracticeContext,
  collectSimulationSampleExternalLinks,
  collectSimulationSampleFiles,
  deriveSimulationSamples,
  type SimulationSampleWorkspaceContext,
} from "@/lib/workspace-simulation-samples";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.SIMULATION_CONTEXT_SCRATCH ||
  process.env.GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-b0100551b8a4/implementer";

function writeEvidence(name: string, body: string) {
  try {
    mkdirSync(SCRATCH, { recursive: true });
    writeFileSync(join(SCRATCH, name), body, "utf8");
  } catch {
    /* optional */
  }
}

function read(rel: string) {
  const path = join(ROOT, rel);
  expect(existsSync(path), `missing ${rel}`).toBe(true);
  return readFileSync(path, "utf8");
}

const thinWorkspace: SimulationSampleWorkspaceContext = {
  workspaceTitle: "Clinic",
  rootTopic: "Bayes",
  workspaceGoal: null,
  workspaceDescription: null,
  notes: null,
  files: [],
  externalResources: [],
  blocks: [
    {
      id: "b1",
      title: "PPV",
      description: "Predictive value basics",
      planning_prompt: null,
      local_context: null,
      next_block_ids: [],
      lock_until_block_ids: [],
      position_x: 0,
      position_y: 0,
    },
  ],
};

const richWorkspace: SimulationSampleWorkspaceContext = {
  workspaceTitle: "Clinical reasoning lab",
  rootTopic: "Bayesian diagnosis",
  workspaceGoal: "Update clinical beliefs from diagnostic test evidence correctly",
  workspaceDescription: "Hands-on PPV/NPV practice with real lab cases",
  notes: "Always state prevalence before sensitivity/specificity.",
  files: [
    {
      name: "lab-panel-case.md",
      excerpt:
        "Patient has 2% prevalence; test sensitivity 90%, specificity 95%. Compute PPV after a positive result.",
    },
  ],
  externalResources: [
    {
      id: "ext-1",
      title: "CDC test interpretation guide",
      url: "https://example.com/cdc-ppv",
      description: "Official walkthrough of base rates and false positives",
    },
  ],
  blocks: [
    {
      id: "b1",
      title: "PPV",
      description: "Predictive value basics",
      planning_prompt: "Use the lab panel numbers",
      local_context: {
        notes: "Focus on false positive rates in low prevalence",
        local_files: [
          {
            name: "block-worksheet.txt",
            excerpt: "Worked example: 1000 patients, 20 diseased",
          },
        ],
        global_file_refs: ["lab-panel-case.md"],
        external_resource_ids: ["ext-1"],
      },
      next_block_ids: ["b2"],
      lock_until_block_ids: [],
      position_x: 0,
      position_y: 0,
      is_start: true,
    },
    {
      id: "b2",
      title: "Base rates",
      description: "How prevalence dominates posterior risk",
      next_block_ids: [],
      position_x: 2,
      position_y: 0,
    },
  ],
};

describe("practice substance includes materials and workspace layers", () => {
  it("practiceMaterialSubstance surfaces files and external links", () => {
    const ctx = {
      blockTitle: "PPV",
      blockDescription: "thin",
      files: [
        { name: "lab-panel-case.md", excerpt: "sensitivity 90% specificity 95%" },
      ],
      externalLinks: [
        {
          title: "CDC guide",
          url: "https://example.com/cdc",
          description: "false positives walkthrough",
        },
      ],
    };
    const mat = practiceMaterialSubstance(ctx);
    expect(mat).toMatch(/lab-panel-case|sensitivity|CDC|false positive/i);
    const domain = practiceDomainSubstance(ctx);
    expect(domain.length).toBeGreaterThan(0);
  });

  it("rich practice context layers differ from thin title-only", () => {
    const thin = buildSimulationSamplePracticeContext(
      { kind: "block", blockId: "b1" },
      thinWorkspace,
    );
    const rich = buildSimulationSamplePracticeContext(
      { kind: "block", blockId: "b1" },
      richWorkspace,
    );

    expect(cleanLen(practiceAllSubstanceLayers(thin))).toBeLessThan(
      cleanLen(practiceAllSubstanceLayers(rich)),
    );
    expect(practiceAllSubstanceLayers(rich)).toMatch(
      /clinical beliefs|lab-panel|CDC|prevalence|false positive/i,
    );
    expect(rich.files?.length).toBeGreaterThan(0);
    expect(rich.externalLinks?.length).toBeGreaterThan(0);
    expect(rich.workspaceGoal).toMatch(/clinical beliefs/i);
    expect(rich.localNotes).toMatch(/false positive/i);
  });
});

function cleanLen(s: string): number {
  return s.replace(/\s+/g, " ").trim().length;
}

describe("deriveSimulationSamples pure path (shipped)", () => {
  it("rich fixture samples reflect goal/files/links and differ from thin run", () => {
    const thin = deriveSimulationSamples(
      { kind: "block", blockId: "b1" },
      thinWorkspace,
    );
    const rich = deriveSimulationSamples(
      { kind: "block", blockId: "b1" },
      richWorkspace,
    );

    expect(rich.questions).toHaveLength(3);
    expect(rich.exercises).toHaveLength(3);
    for (const q of [...rich.questions, ...rich.exercises]) {
      expect(isMetaLearningFluff(q)).toBe(false);
    }

    const thinBlob = [...thin.questions, ...thin.exercises].join("\n");
    const richBlob = [...rich.questions, ...rich.exercises].join("\n");
    expect(richBlob).not.toBe(thinBlob);

    // Material-specific tokens — must not pass with description-only substance
    expect(richBlob).toMatch(/lab-panel/i);
    expect(richBlob).toMatch(/CDC|cdc/i);
    // Numbers from lab excerpt (2% prevalence / 90% / 95%) or worksheet (1000 / 20)
    expect(richBlob).toMatch(
      /0\.9|0\.95|0\.02|90%|95%|2%|1000|diseased|worksheet|false positive/i,
    );
    // Questions must include material body (not only goal-swapped title templates)
    const richQs = rich.questions.join("\n");
    expect(richQs).toMatch(
      /lab-panel|CDC|prevalence|sensitivity|specificity|worksheet|1000|false positive/i,
    );
    const richEx = rich.exercises.join("\n");
    expect(richEx).toMatch(
      /lab-panel|CDC|0\.9|0\.95|0\.02|90|95|1000|worksheet|attached materials/i,
    );

    // Materials-only fixture (no useful description) still differs from thin
    const materialsOnly = deriveSimulationSamples(
      { kind: "block", blockId: "b1" },
      {
        ...thinWorkspace,
        workspaceGoal: richWorkspace.workspaceGoal,
        notes: richWorkspace.notes,
        files: richWorkspace.files,
        externalResources: richWorkspace.externalResources,
        blocks: [
          {
            ...thinWorkspace.blocks![0],
            description: "Predictive value basics",
            local_context: richWorkspace.blocks![0].local_context,
            planning_prompt: "Use the lab panel numbers",
            next_block_ids: ["b2"],
          },
          richWorkspace.blocks![1],
        ],
      },
    );
    const matBlob = [
      ...materialsOnly.questions,
      ...materialsOnly.exercises,
    ].join("\n");
    expect(matBlob).not.toBe(thinBlob);
    expect(matBlob).toMatch(/lab-panel|CDC|0\.9|0\.02|1000|worksheet/i);

    // User prompt for LLM path includes workspace context + links/files
    expect(rich.userPrompt).toMatch(/Workspace goal|clinical beliefs/i);
    expect(rich.userPrompt).toMatch(/lab-panel-case|File|files/i);
    expect(rich.userPrompt).toMatch(/External links|CDC|cdc-ppv/i);
    expect(rich.userPrompt).toMatch(/next →|Map layout|topology|inventory/i);

    writeEvidence(
      "simulation-context-pure.log",
      [
        "=== THIN ===",
        thinBlob,
        "",
        "=== RICH ===",
        richBlob,
        "",
        "=== RICH USER PROMPT (head) ===",
        rich.userPrompt.slice(0, 1200),
        "",
        "practiceContext.files=" + JSON.stringify(rich.practiceContext.files),
        "practiceContext.externalLinks=" +
          JSON.stringify(rich.practiceContext.externalLinks),
        "practiceContext.workspaceGoal=" + rich.practiceContext.workspaceGoal,
      ].join("\n"),
    );
  });

  it("collect helpers merge workspace + block local materials", () => {
    const files = collectSimulationSampleFiles(richWorkspace, "b1");
    expect(files.map((f) => f.name)).toEqual(
      expect.arrayContaining([
        "lab-panel-case.md",
        "block-worksheet.txt",
      ]),
    );
    const links = collectSimulationSampleExternalLinks(richWorkspace, "b1");
    expect(links.some((l) => /CDC/i.test(String(l.title || "")))).toBe(true);
  });

  it("buildGroundedDialogueQuestion uses materials even when description is a non-overview blurb", () => {
    const q = buildGroundedDialogueQuestion(
      {
        blockTitle: "PPV",
        // Non-overview, non-empty — previously blocked materials via practiceDomainSubstance order
        blockDescription: "Predictive value basics for clinical tests",
        workspaceGoal: "Update clinical beliefs from test evidence",
        files: [
          {
            name: "lab-panel-case.md",
            excerpt: "prevalence 2%, sensitivity 90%, specificity 95%",
          },
        ],
        externalLinks: [
          {
            title: "CDC guide",
            description: "base rates and false positives",
          },
        ],
      },
      0,
    );
    expect(isMetaLearningFluff(q)).toBe(false);
    expect(q).toMatch(/lab-panel-case|prevalence 2%|sensitivity 90%|CDC guide|false positive/i);
  });

  it("buildGroundedExerciseItem embeds file numbers and material names", () => {
    const ex = buildGroundedExerciseItem(
      {
        blockTitle: "PPV clinic",
        blockDescription: "Predictive value basics",
        workspaceGoal: "Compute PPV correctly",
        files: [
          {
            name: "lab-panel-case.md",
            excerpt:
              "Patient has 2% prevalence; test sensitivity 90%, specificity 95%. N=1000 patients.",
          },
        ],
        externalLinks: [
          { title: "CDC guide", description: "false positives walkthrough" },
        ],
      },
      0,
    );
    expect(isMetaLearningFluff(ex)).toBe(false);
    expect(ex).toMatch(/lab-panel|0\.9|0\.95|0\.02|90|95|2%|1000|CDC|attached materials/i);
  });

  it("deriveBlockSimulation pure seed grounds on files/externalLinks", async () => {
    const { deriveBlockSimulation, partitionSimulationProbes } = await import(
      "@/lib/block-simulation"
    );
    const sim = deriveBlockSimulation({
      title: "PPV",
      description: "Predictive value basics",
      planningPrompt: "Use lab numbers",
      localNotes: "Focus on false positive rates",
      workspaceGoal: "Update clinical beliefs from test evidence",
      files: [
        {
          name: "lab-panel-case.md",
          excerpt: "2% prevalence, sensitivity 90%, specificity 95%",
        },
      ],
      externalLinks: [
        { title: "CDC guide", description: "base rates and false positives" },
      ],
    });
    const { questions, exercises } = partitionSimulationProbes(sim.probes);
    const blob = [...questions, ...exercises].map((p) => p.question).join("\n");
    expect(blob).toMatch(/lab-panel|CDC|0\.9|0\.02|90|95|2%|false positive/i);
  });
});

describe("simulation API structural wiring", () => {
  it("simulation-samples loads loadWorkspacePromptContext + files + external resources", () => {
    const route = read("app/api/workspace/simulation-samples/route.ts");
    expect(route).toContain("loadWorkspacePromptContext");
    expect(route).toContain("externalResources");
    expect(route).toContain("files: loaded.files");
    expect(route).toContain("buildSimulationSamplePrompts");
    expect(route).toContain("normalizeSimulationSampleResponse");
    // API returns raw model strings — no pure seed substitute
    expect(route).not.toContain("deriveSimulationSamples");
    expect(route).toContain("local_context");
  });

  it("block-content-samples loads workspace_files and external_resources", () => {
    const route = read("app/api/workspace/block-content-samples/route.ts");
    expect(route).toContain("workspace_files");
    expect(route).toContain("workspace_external_resources");
    expect(route).toContain("externalLinks");
    expect(route).toContain("buildSimulationSamplesUserPrompt");
    expect(route).toContain("local_context");
    // Pure pad/sanitize must receive full material rows, not chip labels only
    expect(route).toMatch(/normalizeSimulationPayload\([\s\S]*files,/);
    expect(route).toMatch(/normalizeSimulationPayload\([\s\S]*externalLinks,/);
  });

  it("deriveBlockSimulation + normalize pass files/externalLinks into enforceSimulationProbeQuota", () => {
    const src = read("lib/block-simulation.ts");
    // Both call sites must thread material rows into quota enforcement
    const quotaBlocks = src.split("enforceSimulationProbeQuota");
    expect(quotaBlocks.length).toBeGreaterThanOrEqual(3); // def + 2 call sites
    expect(src).toMatch(
      /enforceSimulationProbeQuota\([\s\S]*?files,[\s\S]*?externalLinks,/,
    );
    // practiceDomainSubstance must not put localNotes ahead of description
    const practice = read("lib/practice-item-builders.ts");
    const domainFn = practice.slice(
      practice.indexOf("export function practiceDomainSubstance"),
      practice.indexOf("export function practiceAllSubstanceLayers"),
    );
    const descIdx = domainFn.indexOf("!looksLikeTopicOverview(desc)");
    const notesIdx = domainFn.indexOf("localNotes.length >= 8");
    expect(descIdx).toBeGreaterThan(0);
    expect(notesIdx).toBeGreaterThan(descIdx);
  });

  it("loadWorkspacePromptContext loads files and external resources", () => {
    const src = read("lib/pow-api/load-workspace-prompt-context.ts");
    expect(src).toContain("workspace_files");
    expect(src).toContain("workspace_external_resources");
    expect(src).toContain("externalResources");
  });

  it("sample helpers and practice builders export material grounding", () => {
    const samples = read("lib/workspace-simulation-samples.ts");
    expect(samples).toContain("collectSimulationSampleFiles");
    expect(samples).toContain("collectSimulationSampleExternalLinks");
    expect(samples).toContain("externalResources");
    expect(samples).toContain("files");
    const practice = read("lib/practice-item-builders.ts");
    expect(practice).toContain("practiceMaterialSubstance");
    expect(practice).toContain("externalLinks");
    expect(practice).toContain("practiceDomainSubstance");
  });

  it("user prompt assembly includes external resources field", () => {
    const prompt = buildSimulationSamplesUserPrompt({
      blockTitle: "PPV",
      blockDescription: "basics",
      workspaceGoal: "Update clinical beliefs",
      notes: "State prevalence first",
      files: [{ name: "case.md", excerpt: "2% prevalence" }],
      externalLinks: [
        { title: "CDC", url: "https://example.com", description: "base rates" },
      ],
      blocks: [
        {
          id: "b1",
          title: "PPV",
          description: "basics",
          next_block_ids: ["b2"],
          position_x: 0,
          position_y: 0,
        },
        {
          id: "b2",
          title: "Base rates",
          next_block_ids: [],
          position_x: 1,
          position_y: 0,
        },
      ],
      focusedBlockId: "b1",
      sampleScope: "block",
    });
    expect(prompt).toMatch(/clinical beliefs|Workspace goal/i);
    expect(prompt).toMatch(/case\.md|2% prevalence|files/i);
    expect(prompt).toMatch(/CDC|External links|base rates/i);
  });
});
