import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  composeIleChapterGenerateSystemMessage,
  composeIleChapterGenerateUserPrompt,
  normalizeIleChapterGenerateResult,
} from "@/lib/ile-chapter-generate";

function read(rel: string) {
  return readFileSync(join(process.cwd(), rel), "utf8");
}

describe("ILE chapter generate (title + description + keyword)", () => {
  it("asks for keyword with title/description, not a truncated title", () => {
    const system = composeIleChapterGenerateSystemMessage("learning");
    expect(system).toContain("keyword");
    expect(system).toMatch(/1 or 2 map words/i);
    expect(system).toMatch(/not copy the first words/i);
    expect(system).toMatch(/Return JSON only/);
    const project = composeIleChapterGenerateSystemMessage("project");
    expect(project).toMatch(/standalone longer-horizon exercise/i);
  });

  it("keeps the model keyword instead of the first two title words", () => {
    const generated = normalizeIleChapterGenerateResult(
      {
        title: "Prove AVL rotate-left after a failing insert",
        description: "Walk a failing insert through rotate-left until the tree is balanced.",
        keyword: "Rotate Left",
      },
      "AVL rotations",
    );
    expect(generated?.keyword).toBe("Rotate Left");
    expect(generated?.keyword).not.toBe("Prove Avl");
    expect(generated?.title).toMatch(/AVL rotate-left/i);
  });

  it("falls back to the seed when the model omits fields", () => {
    const generated = normalizeIleChapterGenerateResult({}, "Binary search trees");
    expect(generated?.title).toBe("Binary search trees");
    expect(generated?.keyword).toBe("Binary Search");
  });

  it("user prompt includes the picked seed and existing chapters", () => {
    const user = composeIleChapterGenerateUserPrompt({
      seed: "AVL rotations",
      sessionGoal: "Balance a tree",
      existingChapters: ["BST insert"],
    });
    expect(user).toContain("AVL rotations");
    expect(user).toContain("BST insert");
    expect(user).toContain("Balance a tree");
  });

  it("ships generate-chapter API and ILE add uses it", () => {
    const route = read("app/api/workspace/generate-chapter/route.ts");
    expect(route).toContain("composeIleChapterGenerateSystemMessage");
    expect(route).toContain("normalizeIleChapterGenerateResult");
    const mutate = read("components/session-view/use-session-mutate.ts");
    expect(mutate).toContain("/api/workspace/generate-chapter");
    expect(mutate).toMatch(/appendIleChapterStep\([\s\S]*keyword/);
  });
});
