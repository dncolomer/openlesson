import { describe, expect, it } from "vitest";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
  SCIENCE_LEARNING_MODEL_CONCEPT_BLURBS,
  SCIENCE_LEARNING_MODEL_COPY,
  SCIENCE_LEARNING_MODEL_FACTORS,
  SCIENCE_LEARNING_MODEL_PATH,
  SCIENCE_LEARNING_MODEL_ROOT,
  SCIENCE_LEARNING_MODEL_TERMS,
  formatScienceLearningModelCost,
  getScienceLearningModelFullText,
  scienceLearningModelCheapestEdge,
  scienceLearningModelNodes,
  scienceLearningModelOutgoingEdges,
  scienceLearningModelPolicyDistance,
  scienceLearningModelTravel,
  splitFactorColoredParts,
} from "@/lib/science/learning-model-copy";

const ROOT = join(__dirname, "../..");

function read(rel: string): string {
  return readFileSync(join(ROOT, rel), "utf8");
}

describe("science learning model page", () => {
  it("explains the generative model, priced edges, projection, and three sessions", () => {
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
      /priced edge/,
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
    expect(full.toLowerCase()).toMatch(/priced edge/);
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

  it("walks priced edges on the Integrals generative model", () => {
    const first = scienceLearningModelTravel(SCIENCE_LEARNING_MODEL_ROOT.id, "accumulation");
    expect(first.focusId).toBe("accumulation");
    expect(first.log.toLowerCase()).toMatch(/travel to hidden state/);
    expect(first.log).toMatch(/Other hidden states at this depth/);
    expect(first.excess).toBe(0);
    const finer = scienceLearningModelTravel("accumulation", "signed-area");
    expect(finer.focusId).toBe("signed-area");
    expect(finer.log).toMatch(/Net change/);
    const leaf = scienceLearningModelTravel("signed-area", "signed-area");
    expect(leaf.focusId).toBe("signed-area");
    const net = scienceLearningModelTravel("net-change", "antiderivative");
    expect(net.focusId).toBe("antiderivative");
    const back = scienceLearningModelTravel("signed-area", "accumulation");
    expect(back.focusId).toBe("accumulation");
    const riemann = scienceLearningModelTravel("riemann", "substitution");
    expect(riemann.focusId).toBe("substitution");
    expect(riemann.log).toMatch(/By parts, Fractions/);
  });

  it("prices the cheapest child edge at the root and a parent edge on a leaf", () => {
    const rootEdges = scienceLearningModelOutgoingEdges("integrals");
    expect(scienceLearningModelCheapestEdge("integrals")?.toId).toBe("accumulation");
    expect(rootEdges[0]?.cost).toBeLessThan(rootEdges[1]?.cost ?? 99);
    expect(scienceLearningModelTravel("integrals", "accumulation").excess).toBe(0);
    expect(scienceLearningModelTravel("integrals", "riemann").excess).toBeGreaterThan(0);

    expect(scienceLearningModelCheapestEdge("accumulation")?.toId).toBe("signed-area");
    expect(scienceLearningModelCheapestEdge("signed-area")?.toId).toBe("accumulation");
    expect(scienceLearningModelCheapestEdge("substitution")?.kind).toBe("parent");
    expect(scienceLearningModelCheapestEdge("limits")?.kind).toBe("parent");

    const cheapestWalk = scienceLearningModelPolicyDistance("integrals", [
      "accumulation",
      "signed-area",
    ]);
    expect(cheapestWalk.focusId).toBe("signed-area");
    expect(cheapestWalk.distance).toBe(0);
    expect(cheapestWalk.excess).toBe(0);

    const dear = scienceLearningModelPolicyDistance("integrals", ["riemann"]);
    expect(dear.distance).toBe(scienceLearningModelTravel("integrals", "riemann").excess);
    expect(dear.distance).toBeGreaterThan(0);
    expect(formatScienceLearningModelCost(rootEdges[0]!.cost)).toBe("0.3");
  });

  it("ships an interactive priced-edge explorer on /science/learning-model", () => {
    expect(SCIENCE_LEARNING_MODEL_PATH).toBe("/science/learning-model");
    expect(existsSync(join(ROOT, "app/science/learning-model/page.tsx"))).toBe(true);
    const page = read("app/science/learning-model/page.tsx");
    expect(page).toContain("LearningModelScene");
    expect(page).not.toContain("LearningModelCatalogs");
    expect(page).not.toContain("learning-model-catalogs");
    expect(page).toContain("LearningModelPipelines");
    expect(page).toContain("LearningModelObjectGlyph");
    expect(page).toContain("data-science-learning-model");
    expect(page).toContain("learning-model-concepts");
    expect(page).toContain("data-learning-model-concept");
    expect(page).not.toContain("data-learning-model-object");
    expect(page).not.toContain("objectsTitle");
    expect(page).not.toContain("max-w-3xl");
    expect(page).not.toContain("max-w-4xl");
    expect(existsSync(join(ROOT, "components/science/LearningModelCatalogs.tsx"))).toBe(false);
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-edge");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-diamond");
    expect(read("components/science/LearningModelScene.tsx")).toContain("graphDiamondEdge");
    expect(read("components/science/LearningModelScene.tsx")).not.toContain("rotate-45");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-draggable");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-dragging");
    expect(read("components/science/LearningModelScene.tsx")).toContain("onPointerDown");
    expect(read("components/science/LearningModelScene.tsx")).toContain("springHome");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-mode");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-mode-tab");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-cheapest");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-distance");
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-explorer-edge-cost");
    expect(read("components/science/LearningModelScene.tsx")).toContain("scienceLearningModelOutgoingEdges");
    expect(read("components/science/LearningModelScene.tsx")).toContain(
      "scienceLearningModelCheapestEdge",
    );
    expect(read("components/science/LearningModelScene.tsx")).toContain('data-learning-model-canvas="2d"');
    expect(read("components/science/LearningModelScene.tsx")).not.toContain("OrbitControls");
    expect(read("components/science/LearningModelScene.tsx")).not.toContain('from "three"');
    expect(read("components/science/LearningModelScene.tsx")).toContain("scienceLearningModelTravel");
    expect(read("lib/science/learning-model-copy.ts")).not.toContain('actionId === "forage"');
    expect(read("components/science/LearningModelScene.tsx")).toContain("data-learning-model-schematic");
    expect(read("components/science/LearningModelPipelines.tsx")).toContain("data-learning-model-mode");
    expect(read("components/science/LearningModelPipelines.tsx")).not.toContain(
      "data-learning-model-step",
    );
    expect(read("components/science/LearningModelMarks.tsx")).toContain("LearningModelActionGlyph");
    expect(read("components/science/LearningModelMarks.tsx")).toContain("AccelerandoMark");
    expect(read("components/excalidraw-canvas/command-plate.tsx")).toContain("AccelerandoMark");
    expect(read("app/science/learning-model/page.tsx")).toContain("overflow-clip");
    expect(read("components/science/LearningModelPipelines.tsx")).toContain("overflow-clip");
    expect(read("components/science/LearningModelScene.tsx")).toContain("overflow-clip");
    expect(read("app/science/page.tsx")).toContain("SCIENCE_LEARNING_MODEL_PATH");
    expect(read("app/sitemap.ts")).toContain("/science/learning-model");
    expect(read("app/science/learning-model/page.tsx")).toContain("LearningModelFactorCopy");
    expect(read("components/science/LearningModelScene.tsx")).toContain("LearningModelFactorCopy");
  });
});
