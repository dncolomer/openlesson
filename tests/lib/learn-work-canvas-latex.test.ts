import { describe, expect, it } from "vitest";
import {
  ileWorkCanvasLatexHtml,
  ileWorkCanvasLatexParts,
  ileWorkCanvasLatexTargets,
  ileWorkCanvasTextHasLatex,
  ileWorkCanvasUnescapeLatex,
} from "@/lib/learn-work-canvas-latex";
import { ileWorkCanvasXaiToolsInstruction } from "@/lib/learn-work-canvas-prompts";
import { readExcalidrawSurface } from "../helpers/surface-source";

describe("Work canvas LaTeX", () => {
  it("splits inline, display, and escaped delimiters", () => {
    const mixed = ileWorkCanvasLatexParts("Show $a^2+b^2=c^2$ then $$\\sum_i i$$.");
    expect(mixed).toEqual([
      { kind: "text", value: "Show " },
      { kind: "math", value: "a^2+b^2=c^2", display: false },
      { kind: "text", value: " then " },
      { kind: "math", value: "\\sum_i i", display: true },
      { kind: "text", value: "." },
    ]);
    expect(ileWorkCanvasLatexParts("Use \\(x_1\\) and \\[E=mc^2\\]")).toEqual([
      { kind: "text", value: "Use " },
      { kind: "math", value: "x_1", display: false },
      { kind: "text", value: " and " },
      { kind: "math", value: "E=mc^2", display: true },
    ]);
  });

  it("leaves currency-like dollars and empty spans alone", () => {
    expect(ileWorkCanvasTextHasLatex("It costs $12.99 today")).toBe(false);
    expect(ileWorkCanvasTextHasLatex("plain prose")).toBe(false);
    expect(ileWorkCanvasTextHasLatex("$100$")).toBe(false);
    expect(ileWorkCanvasTextHasLatex("costs $12 and $x^2$")).toBe(true);
    expect(ileWorkCanvasLatexParts("costs $12 and $x^2$").some((part) => part.kind === "math" && part.value === "x^2")).toBe(
      true,
    );
    expect(ileWorkCanvasTextHasLatex("$x$")).toBe(true);
  });

  it("unescapes doubled backslashes from model copy", () => {
    expect(ileWorkCanvasUnescapeLatex("\\\\frac{1}{2}")).toBe("\\frac{1}{2}");
    expect(ileWorkCanvasUnescapeLatex("\\\\[a\\\\]")).toBe("\\[a\\]");
  });

  it("renders KaTeX html for math and skips prose", () => {
    expect(ileWorkCanvasLatexHtml("no math here")).toBe("");
    const html = ileWorkCanvasLatexHtml("Area $A=\\pi r^2$");
    expect(html).toContain("katex");
    expect(html).toContain("A");
    expect(html).toContain("Area ");
  });

  it("skips the text being edited", () => {
    const targets = ileWorkCanvasLatexTargets(
      [
        {
          id: "t1",
          type: "text",
          x: 0,
          y: 0,
          width: 120,
          height: 24,
          fontSize: 20,
          text: "$x^2$",
          originalText: "$x^2$",
          isDeleted: false,
        } as never,
        {
          id: "t2",
          type: "text",
          x: 0,
          y: 40,
          width: 120,
          height: 24,
          fontSize: 20,
          text: "hello",
          originalText: "hello",
          isDeleted: false,
        } as never,
      ],
      { editingTextElement: { id: "t1" } },
    );
    expect(targets).toEqual([]);
  });

  it("board chrome mounts a KaTeX overlay and asks the model for LaTeX", () => {
    const surface = readExcalidrawSurface();
    expect(surface).toContain("data-ile-canvas-latex");
    expect(surface).toContain("syncLatexOverlay");
    expect(ileWorkCanvasXaiToolsInstruction()).toMatch(/Write mathematics as LaTeX/);
    expect(ileWorkCanvasXaiToolsInstruction()).toContain("$...$");
  });
});
