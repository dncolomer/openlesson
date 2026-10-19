import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  LEARNING_MODEL_CATALOG_16,
  LEARNING_MODEL_CATALOG_4,
  LEARNING_MODEL_CATALOG_8,
} from "@/lib/learning-model";
import {
  SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES,
  SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS,
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_FACTORS,
  SCIENCE_LEARNING_MODEL_PATH,
  SCIENCE_LEARNING_MODEL_ROOT,
  SCIENCE_LEARNING_MODEL_TERMS,
  formatScienceLearningModelCost,
  getScienceLearningModelFullText,
  scienceLearningModelActionCosts,
  scienceLearningModelActionScore,
  scienceLearningModelCheapestAction,
  scienceLearningModelNodes,
  scienceLearningModelPolicyDistance,
  scienceLearningModelStep,
  splitFactorColoredParts,
} from "@/lib/science/learning-model-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("science learning model page", () => {
  it("explains the generative model, actions, projection, and three sessions", () => {
    const full = getScienceLearningModelFullText();
    for (const term of SCIENCE_LEARNING_MODEL_TERMS) {
      expect(full.toLowerCase(), term).toContain(term.toLowerCase());
    }
    expect(SCIENCE_LEARNING_MODEL_COPY.eyebrow).toBe("UNSYS MODEL");
    expect(SCIENCE_LEARNING_MODEL_COPY.lead).toMatch(/^The unsys model is a generative model/);
    expect(full.toLowerCase()).not.toMatch(/\blearning model\b/);
    for (const value of Object.values(SCIENCE_LEARNING_MODEL_COPY)) {
      expect(value, value).not.toMatch(/\blearning model\b/i);
    }
    expect(SCIENCE_LEARNING_MODEL_COPY.title).toBe("A generative model you can act on.");
    expect(SCIENCE_LEARNING_MODEL_COPY.conceptsTitle).toBe("The six Concepts");
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS["generative-model"]).toMatch(
      /concept's hidden states/,
    );
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS["generative-model"]).toMatch(
      /learning simulation of this model/,
    );
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS["hidden-state"]).toMatch(
      /that the user is trying to learn or verify/,
    );
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS["state-factor"]).toMatch(
      /one dimension of the concept/,
    );
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS.observation).toMatch(
      /what we would expect while the user is focusing/,
    );
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS.action).toMatch(
      /move from the current hidden state/,
    );
    expect(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS.policy).toMatch(/learning compass/);
    for (const blurb of Object.values(SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS)) {
      expect(blurb).toMatch(/represents/);
      expect(blurb.toLowerCase()).toMatch(/calibrat|verif|learn/);
      expect(blurb).not.toMatch(/Ice melting/);
      expect(blurb).not.toMatch(/Integrals/);
      expect(blurb).not.toMatch(/Heat in/);
      expect(blurb).not.toMatch(/causes in play/);
      expect(blurb).not.toMatch(/something concrete to land on/);
      expect(blurb.toLowerCase()).not.toMatch(/\bobjects?\b/);
    }
    expect(full.toLowerCase()).toMatch(/concept/);
    expect(full.toLowerCase()).not.toMatch(/\bobjects?\b/);
    for (const value of Object.values(SCIENCE_LEARNING_MODEL_COPY)) {
      expect(value.toLowerCase(), value).not.toMatch(/\bobjects?\b/);
    }
    expect(full.toLowerCase()).toMatch(/free energy principle/);
    expect(full.toLowerCase()).toMatch(/forage/);
    expect(full.toLowerCase()).toMatch(/calibrate/);
    expect(full.toLowerCase()).toMatch(/projection/);
    expect(SCIENCE_LEARNING_MODEL_COPY.caveat.toLowerCase()).toMatch(/influence/);
    expect(SCIENCE_LEARNING_MODEL_COPY.lead).toMatch(/trying to learn or verify/);
    expect(SCIENCE_LEARNING_MODEL_COPY.how).toMatch(/projected onto a policy/);
    expect(SCIENCE_LEARNING_MODEL_COPY.calibrate).toMatch(/prior over hidden states/);
    expect(SCIENCE_LEARNING_MODEL_COPY.learn).toMatch(/cost/);
    expect(SCIENCE_LEARNING_MODEL_COPY.learn).toMatch(/visible/);
    expect(SCIENCE_LEARNING_MODEL_COPY.learn).toMatch(/priced edges/);
    expect(SCIENCE_LEARNING_MODEL_COPY.how).toMatch(/expected-free-energy price/);
    expect(SCIENCE_LEARNING_MODEL_COPY.verify).toMatch(/hidden/);
    expect(SCIENCE_LEARNING_MODEL_COPY.verify).toMatch(/Distance 0/);
    expect(SCIENCE_LEARNING_MODEL_COPY.verify).toMatch(/cheapest policy/);
    expect(SCIENCE_LEARNING_MODEL_COPY.pipelinesLead).toMatch(/costs stay visible/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerOpening).toMatch(/Click or drag a hidden state/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerDragHint).toMatch(/Drag a hidden state/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/Integrals is a frozen generative model/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/state factors/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/observation/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/same depth/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/cost/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/Learn/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLead).toMatch(/Verify/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerLearnCaption).toMatch(/visible/);
    expect(SCIENCE_LEARNING_MODEL_COPY.explorerVerifyCaption).toMatch(/hidden/);
    for (const value of Object.values(SCIENCE_LEARNING_MODEL_COPY)) {
      expect(value, value).not.toMatch(/\blikelihoods?\b/i);
    }
    expect(SCIENCE_LEARNING_MODEL_ROOT.title).toBe("Integrals");
    expect(SCIENCE_LEARNING_MODEL_ROOT.id).toBe("integrals");
    for (const value of Object.values(SCIENCE_LEARNING_MODEL_COPY)) {
      expect(value, value).not.toMatch(/\bguess(es)?\b/i);
    }
    expect(SCIENCE_LEARNING_MODEL_FACTORS).toHaveLength(3);
    expect(SCIENCE_LEARNING_MODEL_FACTORS.map((row) => row.label)).toEqual([
      "Meaning",
      "Technique",
      "Setup",
    ]);
    const colored = splitFactorColoredParts(
      "Three state factors structure it: Meaning, Technique, and Setup.",
    );
    expect(colored.filter((part) => part.color).map((part) => part.text)).toEqual([
      "Meaning",
      "Technique",
      "Setup",
    ]);
    expect(colored.filter((part) => part.color).map((part) => part.color)).toEqual(
      SCIENCE_LEARNING_MODEL_FACTORS.map((row) => row.color),
    );
    expect(splitFactorColoredParts("what the integral means")[0]?.color).toBeNull();
    expect(SCIENCE_LEARNING_MODEL_FACTORS.every((row) => row.states.length >= 4)).toBe(true);
    expect(new Set(SCIENCE_LEARNING_MODEL_FACTORS.map((row) => row.color)).size).toBe(3);
    const nodes = scienceLearningModelNodes();
    const childCounts = nodes.map(
      (node) => nodes.filter((row) => row.parentId === node.id).length,
    );
    expect(Math.max(...childCounts)).toBeGreaterThanOrEqual(3);
    expect(nodes.filter((row) => row.parentId === "accumulation").map((row) => row.id).sort()).toEqual(
      ["net-change", "signed-area"],
    );
    expect(nodes.filter((row) => row.parentId === "riemann").map((row) => row.id).sort()).toEqual([
      "fractions",
      "parts",
      "substitution",
    ]);
    expect(nodes.filter((row) => row.parentId === "definite").map((row) => row.id).sort()).toEqual([
      "differential",
      "limits",
    ]);
    for (const node of scienceLearningModelNodes()) {
      expect(node.observation).toMatch(/We are focusing on this if the observation is/);
      expect(node.observation).not.toMatch(/If this hidden state is the cause/);
    }
  });

  it("walks forage and avoid on the Integrals generative model", () => {
    const first = scienceLearningModelStep(SCIENCE_LEARNING_MODEL_ROOT.id, "forage");
    expect(first.focusId).toBe("accumulation");
    expect(first.log.toLowerCase()).toMatch(/forage/);
    expect(first.log.toLowerCase()).toMatch(/hidden state/);
    expect(first.log).toMatch(/Finer hidden states at this depth/);
    const finer = scienceLearningModelStep("accumulation", "forage");
    expect(finer.focusId).toBe("signed-area");
    expect(finer.log).toMatch(/Signed area, Net change/);
    const leaf = scienceLearningModelStep("signed-area", "forage");
    expect(leaf.focusId).toBe("signed-area");
    const net = scienceLearningModelStep("net-change", "forage");
    expect(net.focusId).toBe("antiderivative");
    const back = scienceLearningModelStep("signed-area", "avoid");
    expect(back.focusId).toBe("accumulation");
    const riemann = scienceLearningModelStep("riemann", "forage");
    expect(riemann.focusId).toBe("substitution");
    expect(riemann.log).toMatch(/Substitution, By parts, Fractions/);
    expect(scienceLearningModelStep("accumulation", "infer").log.toLowerCase()).toMatch(
      /insight is hidden state/,
    );
  });

  it("prices forage cheap at the root and infer cheap on a leaf", () => {
    const root = scienceLearningModelActionCosts("integrals");
    expect(scienceLearningModelCheapestAction("integrals")).toBe("forage");
    expect(root.forage).toBeLessThan(root.exploit);
    expect(root.forage).toBeLessThan(root.avoid);
    expect(root.forage).toBeLessThan(root.infer);
    expect(scienceLearningModelActionScore("integrals", "forage").excess).toBe(0);
    expect(scienceLearningModelActionScore("integrals", "avoid").excess).toBeGreaterThan(0);

    const interior = scienceLearningModelActionCosts("accumulation");
    expect(scienceLearningModelCheapestAction("accumulation")).toBe("forage");
    expect(interior.forage).toBeLessThan(interior.infer);

    const leaf = scienceLearningModelActionCosts("signed-area");
    expect(scienceLearningModelCheapestAction("signed-area")).toBe("infer");
    expect(leaf.infer).toBeLessThan(leaf.forage);
    expect(leaf.infer).toBeLessThan(leaf.exploit);
    expect(scienceLearningModelCheapestAction("substitution")).toBe("infer");
    expect(scienceLearningModelCheapestAction("limits")).toBe("infer");

    const cheapestWalk = scienceLearningModelPolicyDistance("integrals", ["forage", "forage"]);
    expect(cheapestWalk.focusId).toBe("signed-area");
    expect(cheapestWalk.distance).toBe(0);
    expect(cheapestWalk.excess).toBe(0);

    const dear = scienceLearningModelPolicyDistance("integrals", ["exploit"]);
    expect(dear.distance).toBe(scienceLearningModelActionScore("integrals", "exploit").excess);
    expect(dear.distance).toBeGreaterThan(0);
    expect(formatScienceLearningModelCost(root.forage)).toBe("0.3");
  });

  it("gives each catalog action an Integrals natural-language example", () => {
    const ids = new Set(
      [...LEARNING_MODEL_CATALOG_4, ...LEARNING_MODEL_CATALOG_8, ...LEARNING_MODEL_CATALOG_16].map(
        (row) => row.id,
      ),
    );
    expect(Object.keys(SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES).sort()).toEqual([...ids].sort());
    for (const [id, example] of Object.entries(SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES)) {
      expect(example, id).toMatch(/We classify that as /);
      expect(example.toLowerCase(), id).toMatch(/integral|integrand|antiderivative|riemann/);
      expect(example, id).not.toMatch(/\bmaps?\b/i);
      expect(example, id).not.toMatch(/\bobjects?\b/i);
      expect(example, id).not.toMatch(/\bguess(es)?\b/i);
    }
    const catalogs = read("components/science/LearningModelCatalogs.tsx");
    expect(catalogs).toContain("SCIENCE_LEARNING_MODEL_ACTION_EXAMPLES");
    expect(catalogs).toContain("data-learning-model-action-example");
    expect(catalogs).toContain("On Integrals");
    expect(catalogs).toContain("LearningModelFactorCopy");
    expect(read("app/science/learning-model/page.tsx")).toContain("LearningModelFactorCopy");
    expect(read("components/science/LearningModelScene.tsx")).toContain("LearningModelFactorCopy");
  });

  it("ships an interactive 4-action explorer on /science/learning-model", () => {
    expect(SCIENCE_LEARNING_MODEL_PATH).toBe("/science/learning-model");
    expect(existsSync(join(ROOT, "app/science/learning-model/page.tsx"))).toBe(true);
    const page = read("app/science/learning-model/page.tsx");
    expect(page).toContain("LearningModelScene");
    expect(page).toContain("LearningModelCatalogs");
    expect(page).toContain("LearningModelPipelines");
    expect(page).toContain("LearningModelObjectGlyph");
    expect(page).toContain("data-science-learning-model");
    expect(page).toContain("learning-model-concepts");
    expect(page).toContain("data-learning-model-concept");
    expect(page).not.toContain("data-learning-model-object");
    expect(page).not.toContain("objectsTitle");
    expect(page).not.toContain("max-w-3xl");
    expect(page).not.toContain("max-w-4xl");
    expect(read("components/science/LearningModelCatalogs.tsx")).toContain(
      "data-learning-model-catalog={catalog.size}",
    );
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-action");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-draggable");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-dragging");
    expect(read("components/science/LearningModelScene.tsx")).toContain("onPointerDown");
    expect(read("components/science/LearningModelScene.tsx")).toContain("springHome");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-mode");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-mode-tab");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-cheapest");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-distance");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-action-cost");
    expect(read("components/science/LearningModelScene.tsx")).toContain("scienceLearningModelActionCosts");
    expect(read("components/science/LearningModelScene.tsx")).toContain(
      "scienceLearningModelCheapestAction",
    );
    expect(read("components/science/LearningModelScene.tsx")).toContain('data-learning-model-canvas="2d"');
    expect(read("components/science/LearningModelScene.tsx")).not.toContain("OrbitControls");
    expect(read("components/science/LearningModelScene.tsx")).not.toContain('from "three"');
    expect(read("components/science/LearningModelScene.tsx")).toContain("scienceLearningModelStep");
    expect(read("lib/science/learning-model-copy.ts")).toContain('actionId === "forage"');
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-learning-model-schematic");
    expect(read("components/science/LearningModelPipelines.tsx")).toContain("data-learning-model-mode");
    expect(read("components/science/LearningModelPipelines.tsx")).not.toContain(
      "data-learning-model-step",
    );
    expect(read("components/science/LearningModelMarks.tsx")).toContain("LearningModelActionGlyph");
    expect(read("components/science/LearningModelMarks.tsx")).toContain("AccelerandoMark");
    expect(read("components/excalidraw-canvas/command-plate.tsx")).toContain("AccelerandoMark");
    expect(read("app/science/learning-model/page.tsx")).toContain("overflow-clip");
    expect(read("components/science/LearningModelCatalogs.tsx")).toContain("overflow-clip");
    expect(read("components/science/LearningModelPipelines.tsx")).toContain("overflow-clip");
    expect(read("components/science/LearningModelScene.tsx")).toContain("overflow-clip");
    expect(read("app/science/page.tsx")).toContain("SCIENCE_LEARNING_MODEL_PATH");
    expect(read("app/sitemap.ts")).toContain("/science/learning-model");
  });
});
