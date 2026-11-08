import { describe, expect, it } from "vitest";
import {
  formatHeliosSearchResultsForPrompt,
  parseXaiWebSearchResult,
  urlsFromSearchText,
} from "@/lib/xai-web-search";
import {
  heliosFlowCreateInput,
  heliosWillCreateFlow,
} from "@/lib/workspace-helios-flow";

describe("Helios web search + create-flow args", () => {
  it("parses citations and URLs from a search payload", () => {
    const parsed = parseXaiWebSearchResult(
      "mwpm paper",
      "See https://arxiv.org/abs/1234.5678 for the decoder.",
      { citations: ["https://arxiv.org/pdf/1234.5678"] },
    );
    expect(parsed.hits.map((h) => h.url)).toEqual([
      "https://arxiv.org/pdf/1234.5678",
      "https://arxiv.org/abs/1234.5678",
    ]);
    expect(urlsFromSearchText("no links")).toEqual([]);
    const prompt = formatHeliosSearchResultsForPrompt([parsed]);
    expect(prompt).toContain("SEARCH RESULTS");
    expect(prompt).toContain("ask which to attach");
    expect(prompt).toContain("https://arxiv.org/pdf/1234.5678");
  });

  it("treats missing flowId on a flow kind as create-then-link", () => {
    expect(heliosWillCreateFlow({ kind: "calibration", title: "Priors" })).toBe(
      true,
    );
    expect(
      heliosWillCreateFlow({ kind: "calibration", flowId: "cal-1" }),
    ).toBe(false);
    expect(heliosWillCreateFlow({ kind: "learn" })).toBe(true);
    expect(heliosWillCreateFlow({})).toBe(true);
    expect(heliosWillCreateFlow({ kind: "content" })).toBe(false);
    const draft = heliosFlowCreateInput({
      kind: "verification",
      title: "Distance",
    });
    expect(draft.kind).toBe("verification");
    expect(draft.topic).toBe("Distance");
    expect(draft.questions).toEqual(["Distance"]);
    expect(draft.artifacts).toEqual([]);
    expect(
      heliosFlowCreateInput({
        kind: "calibration",
        flowName: "Priors",
        problem: "State the noise model",
        artifacts: [
          {
            name: "brief.pdf",
            mimeType: "application/pdf",
            xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
          },
        ],
      }),
    ).toMatchObject({
      kind: "calibration",
      name: "Priors",
      topic: "State the noise model",
      goal: "State the noise model",
      questions: ["State the noise model"],
      artifacts: [
        {
          name: "brief.pdf",
          mimeType: "application/pdf",
          xaiFileId: "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        },
      ],
    });
    expect(heliosFlowCreateInput({ title: "Research" }).kind).toBe("solve");
    expect(heliosFlowCreateInput({ kind: "learn", title: "Old" }).kind).toBe(
      "solve",
    );
  });
});
