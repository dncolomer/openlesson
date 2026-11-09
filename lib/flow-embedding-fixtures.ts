/**
 * Hand-crafted trees, walks, and short transcripts for CPU embedding tests.
 * Same recoverable raw shape as live capture (flowKind + genModel + policy + pow).
 */

import type { FlowEmbeddingRaw, FlowGenModelRaw, FlowKind, FlowPowRow } from "@/lib/flow-embedding";

export type HarnessRole = "expert" | "novice" | "heldout" | "unknown";

export type FlowHarnessCase = {
  id: string;
  label: string;
  problem: string;
  role: HarnessRole;
  raw: FlowEmbeddingRaw;
};

function branch(
  id: string,
  parentId: string | null,
  depth: number,
  title: string,
  edges: Array<{ toId: string; price: number }>,
): FlowGenModelRaw["branches"][number] {
  return {
    id,
    parentId,
    title,
    question: `What is ${title}?`,
    territory: title.toLowerCase(),
    observation: `${title} is open.`,
    depth,
    status: "open",
    edges,
  };
}

function speechPow(text: string, timestampMs = 1): FlowPowRow {
  return {
    type: "tool",
    tool_name: "speech-segment",
    tool_action: "speech_stop",
    timestamp_ms: timestampMs,
    payload: text,
    metadata: { transcript_snapshot: text },
  };
}

function policy(sequence: string[], excess = 0, distance = 0) {
  return {
    sequence,
    steps: sequence.length,
    excess,
    distance,
  };
}

/** Cheap vs costly first ring, two leaves. Same tree for every quadratic walk. */
export function quadraticTree(): FlowGenModelRaw {
  return {
    chapterTitle: "Quadratic",
    rootId: "root",
    branches: [
      branch("root", null, 0, "Quadratic", [
        { toId: "cheap", price: 8 },
        { toId: "costly", price: 90 },
      ]),
      branch("cheap", "root", 1, "Complete the square", [{ toId: "cheap-leaf", price: 12 }]),
      branch("cheap-leaf", "cheap", 2, "Vertex form", []),
      branch("costly", "root", 1, "Expand every term", [{ toId: "costly-leaf", price: 85 }]),
      branch("costly-leaf", "costly", 2, "Guess the roots", []),
    ],
  };
}

/** Held-out problem: different titles and prices, same cheap/costly shape. */
export function seriesTree(): FlowGenModelRaw {
  return {
    chapterTitle: "Geometric series",
    rootId: "root",
    branches: [
      branch("root", null, 0, "Geometric series", [
        { toId: "ratio", price: 10 },
        { toId: "remainder", price: 92 },
      ]),
      branch("ratio", "root", 1, "Common ratio", [{ toId: "ratio-leaf", price: 14 }]),
      branch("ratio-leaf", "ratio", 2, "Closed form", []),
      branch("remainder", "root", 1, "Partial sums by hand", [{ toId: "remainder-leaf", price: 80 }]),
      branch("remainder-leaf", "remainder", 2, "Term listing", []),
    ],
  };
}

function caseRaw(
  flowKind: FlowKind,
  tree: FlowGenModelRaw,
  sequence: string[],
  pow: FlowPowRow[],
  scored?: { excess: number; distance: number },
): FlowEmbeddingRaw {
  return {
    flowKind,
    genModel: tree,
    projectedPolicy: sequence.length ? policy(sequence, scored?.excess ?? 0, scored?.distance ?? 0) : null,
    pow,
  };
}

const EXPERT_TALK = "take the cheaper branch and complete the square to vertex form";
const EXPERT_TALK_SHORT = "cheaper branch complete the square";
const EXPERT_TALK_LONG =
  "take the cheaper branch and complete the square to vertex form then check the discriminant before moving on";
const NOVICE_TALK = "i guessed the last option and expanded every term";
const SERIES_EXPERT_TALK = "use the common ratio and write the closed form";
const SERIES_NOVICE_TALK = "i listed every remaining term by hand";

export function syntheticFlowHarnessCases(): FlowHarnessCase[] {
  const quadratic = quadraticTree();
  const series = seriesTree();
  return [
    {
      id: "q-expert-a",
      label: "quadratic expert cheap walk",
      problem: "quadratic",
      role: "expert",
      raw: caseRaw("verify", quadratic, ["cheap", "cheap-leaf"], [speechPow(EXPERT_TALK)], {
        excess: 0,
        distance: 20,
      }),
    },
    {
      id: "q-expert-b",
      label: "quadratic expert cheap walk variant",
      problem: "quadratic",
      role: "expert",
      raw: caseRaw("verify", quadratic, ["cheap", "cheap-leaf"], [speechPow(EXPERT_TALK_SHORT, 2)], {
        excess: 0,
        distance: 20,
      }),
    },
    {
      id: "q-expert-c",
      label: "quadratic expert cheap walk long transcript",
      problem: "quadratic",
      role: "expert",
      raw: caseRaw("verify", quadratic, ["cheap", "cheap-leaf"], [speechPow(EXPERT_TALK_LONG, 3)], {
        excess: 0,
        distance: 20,
      }),
    },
    {
      id: "q-expert-silent",
      label: "quadratic expert cheap walk no transcript",
      problem: "quadratic",
      role: "expert",
      raw: caseRaw("verify", quadratic, ["cheap", "cheap-leaf"], [
        { type: "tool", tool_name: "session_policy", tool_action: "cheap-leaf", timestamp_ms: 1 },
      ], { excess: 0, distance: 20 }),
    },
    {
      id: "q-novice-a",
      label: "quadratic novice costly walk",
      problem: "quadratic",
      role: "novice",
      raw: caseRaw("verify", quadratic, ["costly", "costly-leaf"], [speechPow(NOVICE_TALK, 4)], {
        excess: 140,
        distance: 175,
      }),
    },
    {
      id: "q-novice-b",
      label: "quadratic novice costly short",
      problem: "quadratic",
      role: "novice",
      raw: caseRaw("verify", quadratic, ["costly"], [speechPow(NOVICE_TALK, 5)], {
        excess: 80,
        distance: 90,
      }),
    },
    {
      id: "s-expert",
      label: "series expert held-out",
      problem: "series",
      role: "heldout",
      raw: caseRaw("verify", series, ["ratio", "ratio-leaf"], [speechPow(SERIES_EXPERT_TALK, 6)], {
        excess: 0,
        distance: 24,
      }),
    },
    {
      id: "s-novice",
      label: "series novice held-out",
      problem: "series",
      role: "heldout",
      raw: caseRaw("verify", series, ["remainder", "remainder-leaf"], [speechPow(SERIES_NOVICE_TALK, 7)], {
        excess: 150,
        distance: 172,
      }),
    },
  ];
}

export function corpusRecordToHarnessCase(
  record: {
    sessionId: string;
    kind?: string;
    label?: string;
    problem?: string;
    role?: string;
  },
  raw: FlowEmbeddingRaw,
): FlowHarnessCase {
  const role = record.role;
  return {
    id: record.sessionId,
    label: record.label?.trim() || record.sessionId,
    problem: record.problem?.trim() || raw.genModel.chapterTitle || "unknown",
    role:
      role === "expert" || role === "novice" || role === "heldout" || role === "unknown"
        ? role
        : "unknown",
    raw,
  };
}
