/**
 * Prepare a Learn session field with xAI.
 * There is no handwritten chapter tree. A short reply is refused.
 * The session opens after the premise and the first regions. The rest of the field
 * is written in small batches while the session is already on.
 * Avenues and inquiries stay in small slices so one call can finish inside the request timeout.
 * Each parent gets between 2 and 8 children; xAI chooses how many.
 */

import { addAuthorUnsysGeneratedChildren } from "@/lib/author-unsys-model";
import {
  hydrateSessionBranchModel,
  normalizeSessionBranchModel,
  sessionBranchById,
  sessionBranchParentsNeedingGrowth,
  SESSION_BRANCH_ACCEPT_COUNT,
  SESSION_BRANCH_AVENUE_COUNT,
  SESSION_BRANCH_CHILD_MAX,
  SESSION_BRANCH_CHILD_MIN,
  SESSION_BRANCH_INQUIRY_COUNT,
  SESSION_BRANCH_REGION_COUNT,
  SESSION_BRANCH_TARGET_COUNT,
  type SessionBranchDraft,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import { callXai, systemMessage, userMessage, type JsonSchema } from "@/lib/xai-client";

export type SessionBranchGenerateResult =
  | { ok: true; model: SessionBranchModel }
  | { ok: false; error: string };

const NODE_PROPERTIES = {
  title: { type: "string" },
  question: { type: "string" },
  territory: { type: "string" },
  observation: { type: "string" },
  edgePrice: { type: "number" },
} as const;

const NODE_REQUIRED = ["title", "question", "territory", "observation", "edgePrice"] as const;

const SYSTEM = [
  "You write one slice of a session field as JSON.",
  "Every title is a short phrase.",
  "Every question is one original interrogative sentence a learner would be asked. Write it from scratch. Never wrap the title or territory into a stock sentence.",
  "Every territory and observation is one or two complete sentences about this chapter.",
  "edgePrice is a number from 0 to 100: the cost of travelling to that hidden state from its parent. A lower edgePrice is the better next hidden state.",
  `Choose how many children the concept needs, between ${SESSION_BRANCH_CHILD_MIN} and ${SESSION_BRANCH_CHILD_MAX}. Do not pad.`,
  "No headings, no bullets, no product names.",
].join(" ");

function objectSchema(
  name: string,
  required: string[],
  properties: Record<string, unknown>,
): JsonSchema {
  return {
    name,
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required,
      properties,
    },
  };
}

function nodeItemSchema(extra: Record<string, unknown> = {}, extraRequired: string[] = []) {
  return {
    type: "object",
    additionalProperties: false,
    required: [...extraRequired, ...NODE_REQUIRED],
    properties: { ...extra, ...NODE_PROPERTIES },
  };
}

const ROOT_PROPERTIES = {
  premise: { type: "string" },
  question: { type: "string" },
  territory: { type: "string" },
  observation: { type: "string" },
} as const;

function regionSchema(): JsonSchema {
  return objectSchema("session_branch_regions", ["premise", "question", "territory", "observation", "regions"], {
    ...ROOT_PROPERTIES,
    regions: { type: "array", items: nodeItemSchema() },
  });
}

function avenueSchema(): JsonSchema {
  return objectSchema("session_branch_avenues", ["avenues"], {
    avenues: {
      type: "array",
      items: nodeItemSchema({ region: { type: "number" } }, ["region"]),
    },
  });
}

function singleRegionSchema(): JsonSchema {
  return objectSchema("session_branch_region", ["region"], {
    region: nodeItemSchema(),
  });
}

function inquirySchema(): JsonSchema {
  return objectSchema("session_branch_inquiries", ["inquiries"], {
    inquiries: {
      type: "array",
      items: nodeItemSchema(
        { region: { type: "number" }, avenue: { type: "number" } },
        ["region", "avenue"],
      ),
    },
  });
}

function childrenSchema(): JsonSchema {
  return objectSchema("session_branch_children", ["children"], {
    children: { type: "array", items: nodeItemSchema() },
  });
}

type FieldNode = Record<string, unknown>;

function asRecord(value: unknown): FieldNode | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as FieldNode;
}

function asList(value: unknown): FieldNode[] {
  if (!Array.isArray(value)) return [];
  return value.map(asRecord).filter((row): row is FieldNode => row != null);
}

function textOf(value: unknown): string {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function numberOf(value: unknown): number | null {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function filled(nodes: readonly FieldNode[]): number {
  return nodes.filter(
    (node) => textOf(node.title) && textOf(node.question) && textOf(node.observation),
  ).length;
}

function materialBlock(input: { chapterTitle: string; chapterBrief?: string | null }): string {
  const title = textOf(input.chapterTitle) || textOf(input.chapterBrief) || "this chapter";
  const brief = textOf(input.chapterBrief);
  return [
    `Chapter: ${title}.`,
    brief ? `Material:\n${brief}` : "",
    "This slice belongs to a wide field of inquiry, not a short quiz and not a three-step maze.",
    "Write in complete sentences. Each question is an original interrogative sentence, not a wrap of the title. No headings, no bullets, no product names.",
  ]
    .filter(Boolean)
    .join("\n\n");
}

async function ask(
  schema: JsonSchema,
  prompt: string,
  maxTokens: number,
): Promise<{ ok: true; data: FieldNode } | { ok: false; error: string }> {
  const response = await callXai<FieldNode>(
    [systemMessage(SYSTEM), userMessage(prompt)],
    {
      maxTokens,
      temperature: 0.3,
      responseFormat: "json_schema",
      jsonSchema: schema,
      reasoningEffort: "low",
      fetchTimeout: 90_000,
      retries: 2,
    },
  );
  if (!response.success || !response.data || typeof response.data !== "object") {
    return { ok: false, error: response.error || "The field could not be prepared." };
  }
  return { ok: true, data: response.data };
}

function listedCount(data: FieldNode): number {
  return filled(asList(data.regions ?? data.avenues ?? data.inquiries ?? data.children));
}

async function askUntil(
  schema: JsonSchema,
  prompt: string,
  maxTokens: number,
  accept: (data: FieldNode) => boolean,
): Promise<{ ok: true; data: FieldNode } | { ok: false; error: string }> {
  const first = await ask(schema, prompt, maxTokens);
  if (!first.ok) return first;
  if (accept(first.data)) return first;
  const second = await ask(
    schema,
    `${prompt}\n\nThe last reply was too small. Write every item this request asks for. Do not stop early.`,
    maxTokens,
  );
  if (!second.ok) return first;
  if (accept(second.data) || listedCount(second.data) >= listedCount(first.data)) return second;
  return first;
}

/** One region per avenue call. A 24-avenue reply does not finish before the request timeout. */
export function planSessionBranchAvenueCalls(regionCount: number, avenuesPerRegion: number) {
  return Array.from({ length: Math.max(0, regionCount) }, (_, regionOffset) => ({
    regionOffset,
    expected: avenuesPerRegion,
  }));
}

/** Two avenues per inquiry call. A 36-inquiry reply does not finish before the request timeout. */
export function planSessionBranchInquiryCalls(
  regionCount: number,
  avenuesPerRegion: number,
  inquiriesPerAvenue: number,
  avenuesPerCall = 2,
) {
  const size = Math.max(1, avenuesPerCall);
  const calls: { regionOffset: number; avenueOffset: number; avenueCount: number; expected: number }[] = [];
  for (let regionOffset = 0; regionOffset < regionCount; regionOffset += 1) {
    for (let avenueOffset = 0; avenueOffset < avenuesPerRegion; avenueOffset += size) {
      const avenueCount = Math.min(size, avenuesPerRegion - avenueOffset);
      calls.push({
        regionOffset,
        avenueOffset,
        avenueCount,
        expected: avenueCount * inquiriesPerAvenue,
      });
    }
  }
  return calls;
}

export async function mapWithConcurrency<T, R>(
  items: readonly T[],
  limit: number,
  run: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(Math.max(1, limit), items.length) }, async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await run(items[index] as T, index);
    }
  });
  await Promise.all(workers);
  return results;
}

/** Four calls at a time. A full-list reply does not finish before AbortSignal.timeout. */
const FIELD_CALL_CONCURRENCY = 4;

export function tokensForNodes(count: number): number {
  return Math.min(8000, 700 + Math.max(1, count) * 450);
}

function avenuesForSlice(
  avenues: readonly FieldNode[],
  regionNumber: number,
  avenueOffset: number,
  avenueCount: number,
): FieldNode[] {
  const rows = avenues.filter((avenue) => numberOf(avenue.region) === regionNumber);
  const numbered = rows.filter((avenue) => {
    const avenueNumber = numberOf(avenue.avenue);
    return avenueNumber != null && avenueNumber > avenueOffset && avenueNumber <= avenueOffset + avenueCount;
  });
  if (numbered.length) return numbered;
  return rows.slice(avenueOffset, avenueOffset + avenueCount);
}

export function assembleSessionBranchDraft(input: {
  root: FieldNode;
  regions: readonly FieldNode[];
  avenues: readonly FieldNode[];
  inquiries: readonly FieldNode[];
}): SessionBranchDraft {
  const regions = input.regions.map((region, regionIndex) => {
    const regionNumber = regionIndex + 1;
    const avenues = input.avenues
      .filter((avenue) => numberOf(avenue.region) === regionNumber)
      .map((avenue, avenueIndex) => {
        const avenueNumber = numberOf(avenue.avenue) ?? avenueIndex + 1;
        const inquiries = input.inquiries.filter(
          (inquiry) =>
            numberOf(inquiry.region) === regionNumber && numberOf(inquiry.avenue) === avenueNumber,
        );
        return { ...avenue, inquiries };
      });
    return { ...region, avenues };
  });
  return { ...input.root, regions };
}

function clampChildCount(value: unknown, fallback = SESSION_BRANCH_CHILD_MAX): number {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n) || n < 1) return fallback;
  return Math.max(SESSION_BRANCH_CHILD_MIN, Math.min(SESSION_BRANCH_CHILD_MAX, n));
}

export async function generateSessionBranchFirstLevel(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
  regionCount?: number;
}): Promise<SessionBranchGenerateResult> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  const regionMax = clampChildCount(input.regionCount, SESSION_BRANCH_CHILD_MAX);
  if (!chapterTitle && !chapterBrief) {
    return { ok: false, error: "A chapter is required." };
  }
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };
  const regionsReply = await askUntil(
    regionSchema(),
    [
      materialBlock(material),
      `Write the premise and between ${SESSION_BRANCH_CHILD_MIN} and ${regionMax} regions.`,
      "Choose how many regions the concept needs. Do not pad.",
      "Do not write avenues or inquiries in this reply.",
      "The regions must cover different parts of the chapter.",
    ].join("\n\n"),
    tokensForNodes(regionMax),
    (data) => filled(asList(data.regions)) >= SESSION_BRANCH_CHILD_MIN && Boolean(textOf(data.premise)),
  );
  if (!regionsReply.ok) return regionsReply;
  const regions = asList(regionsReply.data.regions).slice(0, regionMax);
  if (filled(regions) < 1 || !textOf(regionsReply.data.premise)) {
    return { ok: false, error: "The field came back too small to work in." };
  }
  const model = modelFromContinuation(
    asContinuation({
      ...emptySessionBranchContinuation(regionsReply.data),
      regions,
    }),
    material.chapterTitle,
  );
  if (!model) return { ok: false, error: "The field came back too small to work in." };
  return { ok: true, model };
}

export type SessionBranchChildDraft = {
  title: string;
  question: string;
  territory: string;
  observation: string;
  edgePrice: number;
};

function childDraftFromNode(node: FieldNode): SessionBranchChildDraft | null {
  const title = textOf(node.title);
  const question = textOf(node.question);
  const observation = textOf(node.observation) || title;
  if (!title || !question) return null;
  const edgePrice = Number(node.edgePrice);
  return {
    title,
    question,
    territory: textOf(node.territory) || observation,
    observation,
    edgePrice: Number.isFinite(edgePrice) ? Math.max(0, Math.min(100, Math.round(edgePrice))) : 20,
  };
}

export async function generateSessionBranchChildren(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
  parentTitle: string;
  parentQuestion?: string;
  parentTerritory?: string;
  siblingTitles?: string[];
  count?: number;
}): Promise<
  | { ok: true; children: SessionBranchChildDraft[] }
  | { ok: false; error: string }
> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  const maxCount = clampChildCount(input.count, SESSION_BRANCH_CHILD_MAX);
  const parentTitle = textOf(input.parentTitle);
  if ((!chapterTitle && !chapterBrief) || !parentTitle) {
    return { ok: false, error: "A chapter is required." };
  }
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };
  const siblings = (input.siblingTitles ?? [])
    .map((title) => textOf(title))
    .filter(Boolean);
  const reply = await askUntil(
    childrenSchema(),
    [
      materialBlock(material),
      `Parent hidden state: ${parentTitle}.`,
      textOf(input.parentQuestion) ? `Parent question: ${textOf(input.parentQuestion)}` : "",
      textOf(input.parentTerritory) ? `Parent territory: ${textOf(input.parentTerritory)}` : "",
      siblings.length ? `Already on this parent:\n${siblings.map((title) => `- ${title}`).join("\n")}` : "",
      `Write between ${SESSION_BRANCH_CHILD_MIN} and ${maxCount} hidden states one step deeper than the parent.`,
      "Choose how many the concept needs. Do not pad.",
      "They must diverge. Do not repeat the parent title or a title already listed.",
    ]
      .filter(Boolean)
      .join("\n\n"),
    tokensForNodes(maxCount),
    (data) => filled(asList(data.children)) >= SESSION_BRANCH_CHILD_MIN,
  );
  if (!reply.ok) return reply;
  const children = asList(reply.data.children)
    .map((node) => childDraftFromNode(node))
    .filter((row): row is SessionBranchChildDraft => Boolean(row))
    .slice(0, maxCount);
  if (!children.length) return { ok: false, error: "The field came back too small to work in." };
  return { ok: true, children };
}

export async function generateSessionBranchModel(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
}): Promise<SessionBranchGenerateResult> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  if (!chapterTitle && !chapterBrief) {
    return { ok: false, error: "A chapter is required." };
  }
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };

  const regionsReply = await askUntil(
    regionSchema(),
    [
      materialBlock(material),
      `Write the premise and exactly ${SESSION_BRANCH_REGION_COUNT} regions.`,
      "Do not write avenues or inquiries in this reply.",
      "The regions must cover different parts of the chapter.",
    ].join("\n\n"),
    6000,
    (data) => filled(asList(data.regions)) >= SESSION_BRANCH_REGION_COUNT && Boolean(textOf(data.premise)),
  );
  if (!regionsReply.ok) return regionsReply;
  const regions = asList(regionsReply.data.regions).slice(0, SESSION_BRANCH_REGION_COUNT);
  if (filled(regions) < SESSION_BRANCH_REGION_COUNT) {
    return { ok: false, error: "The field came back too small to work in." };
  }

  const avenuePlan = planSessionBranchAvenueCalls(
    SESSION_BRANCH_REGION_COUNT,
    SESSION_BRANCH_AVENUE_COUNT,
  );
  const avenueResults = await mapWithConcurrency(avenuePlan, FIELD_CALL_CONCURRENCY, async (call) => {
    const region = regions[call.regionOffset];
    const regionNumber = call.regionOffset + 1;
    const reply = await askUntil(
      avenueSchema(),
      [
        materialBlock(material),
        "Region already chosen:",
        `${regionNumber}. ${textOf(region?.title)} — ${textOf(region?.territory)}`,
        `Write exactly ${call.expected} avenues for region ${regionNumber}.`,
        `Set region to ${regionNumber} on every avenue.`,
        "Avenues must diverge. Do not write inquiries in this reply.",
      ].join("\n\n"),
      tokensForNodes(call.expected),
      (data) => filled(asList(data.avenues)) >= call.expected,
    );
    return { call, reply };
  });
  const failedAvenue = avenueResults.find((result) => !result.reply.ok);
  if (failedAvenue && !failedAvenue.reply.ok) return { ok: false, error: failedAvenue.reply.error };
  const avenues = avenueResults.flatMap((result) => {
    if (!result.reply.ok) return [];
    return asList(result.reply.data.avenues)
      .slice(0, result.call.expected)
      .map((avenue, index) => ({
        ...avenue,
        region: result.call.regionOffset + 1,
        avenue: index + 1,
      }));
  });
  if (filled(avenues) < SESSION_BRANCH_REGION_COUNT * SESSION_BRANCH_AVENUE_COUNT) {
    return { ok: false, error: "The field came back too small to work in." };
  }

  const inquiryPlan = planSessionBranchInquiryCalls(
    SESSION_BRANCH_REGION_COUNT,
    SESSION_BRANCH_AVENUE_COUNT,
    SESSION_BRANCH_INQUIRY_COUNT,
    2,
  );
  const inquiryResults = await mapWithConcurrency(inquiryPlan, FIELD_CALL_CONCURRENCY, async (call) => {
    const regionNumber = call.regionOffset + 1;
    const listed = avenuesForSlice(avenues, regionNumber, call.avenueOffset, call.avenueCount).map(
      (avenue, index) => {
        const avenueNumber = numberOf(avenue.avenue) ?? call.avenueOffset + index + 1;
        return {
          avenueNumber,
          line: `${regionNumber}.${avenueNumber} ${textOf(avenue.title)} — ${textOf(avenue.territory)}`,
        };
      },
    );
    const reply = await askUntil(
      inquirySchema(),
      [
        materialBlock(material),
        "Avenues to go further into:",
        listed.map((item) => item.line).join("\n"),
        `Write exactly ${SESSION_BRANCH_INQUIRY_COUNT} inquiries for every avenue listed.`,
        "region is the first number and avenue is the second number. Copy both onto every inquiry for that avenue.",
        "An inquiry goes further into that avenue. It must not repeat the avenue title.",
      ].join("\n\n"),
      tokensForNodes(call.expected),
      (data) => filled(asList(data.inquiries)) >= call.expected,
    );
    return { call, reply, listed };
  });
  const failedInquiry = inquiryResults.find((result) => !result.reply.ok);
  if (failedInquiry && !failedInquiry.reply.ok) return { ok: false, error: failedInquiry.reply.error };
  const inquiries = inquiryResults.flatMap((result) => {
    if (!result.reply.ok) return [];
    const regionNumber = result.call.regionOffset + 1;
    return asList(result.reply.data.inquiries).map((inquiry, index) => {
      const chunk = Math.min(
        Math.max(0, result.listed.length - 1),
        Math.floor(index / SESSION_BRANCH_INQUIRY_COUNT),
      );
      const fallbackAvenue = result.listed[chunk]?.avenueNumber ?? null;
      return {
        ...inquiry,
        region: numberOf(inquiry.region) ?? regionNumber,
        avenue: numberOf(inquiry.avenue) ?? fallbackAvenue,
      };
    });
  });

  const draft = assembleSessionBranchDraft({
    root: regionsReply.data,
    regions,
    avenues,
    inquiries,
  });
  const model = normalizeSessionBranchModel(draft, material.chapterTitle);
  if (!model || model.branches.length < SESSION_BRANCH_ACCEPT_COUNT) {
    return {
      ok: false,
      error: `The field came back with ${model?.branches.length ?? 0} branches. This session needs at least ${SESSION_BRANCH_ACCEPT_COUNT}, and the full field is ${SESSION_BRANCH_TARGET_COUNT}.`,
    };
  }
  return { ok: true, model };
}

/** Calls in one continue request. Two at a time, so a batch stays inside maxDuration. */
export const SESSION_BRANCH_CONTINUATION_BATCH = 4;
const CONTINUE_CONCURRENCY = 2;
const OPENING_REGION_TOKENS = 2500;

export type SessionBranchContinuation = {
  root: Record<string, unknown>;
  regions: Record<string, unknown>[];
  avenues: Record<string, unknown>[];
  inquiries: Record<string, unknown>[];
  /** Extra region calls that failed. They are not retried. */
  regionFailures: number;
  failed: string[];
  /** Slices that returned something. A short reply is kept and not asked again. */
  settled: string[];
  /** Author seed (or already-grown seed) to graft onto. Opening loads this as-is. */
  seedModel?: SessionBranchModel | null;
};

type ContinuationSlice =
  | { kind: "region"; ordinal: number }
  | { kind: "avenues"; regionNumber: number }
  | { kind: "inquiries"; regionNumber: number; avenueOffset: number; avenueCount: number };

export function emptySessionBranchContinuation(
  root: Record<string, unknown>,
): SessionBranchContinuation {
  return {
    root,
    regions: [],
    avenues: [],
    inquiries: [],
    regionFailures: 0,
    failed: [],
    settled: [],
  };
}

function asContinuation(value: SessionBranchContinuation | null | undefined): SessionBranchContinuation {
  const seedModel = hydrateSessionBranchModel(value?.seedModel);
  return {
    root: asRecord(value?.root) ?? {},
    regions: asList(value?.regions),
    avenues: asList(value?.avenues),
    inquiries: asList(value?.inquiries),
    regionFailures: Math.max(0, Number(value?.regionFailures) || 0),
    failed: Array.isArray(value?.failed) ? value.failed.filter((item) => typeof item === "string") : [],
    settled: Array.isArray(value?.settled) ? value.settled.filter((item) => typeof item === "string") : [],
    seedModel,
  };
}

function nodeFromBranch(branch: {
  title: string;
  question: string;
  territory: string;
  observation: string;
  edges?: { price: number }[];
}): FieldNode {
  return {
    title: branch.title,
    question: branch.question,
    territory: branch.territory,
    observation: branch.observation,
    edgePrice: branch.edges?.[0]?.price ?? 20,
  };
}

/** Opening continuation for an author seed. Later rounds graft children onto seedModel. */
export function sessionBranchContinuationFromSeed(
  model: SessionBranchModel,
): SessionBranchContinuation {
  const root = sessionBranchById(model, model.rootId);
  const regions = model.branches.filter((branch) => branch.depth === 1);
  const avenues = model.branches.filter((branch) => branch.depth === 2);
  const inquiries = model.branches.filter((branch) => branch.depth >= 3);
  const numberedAvenues = avenues.map((branch, index) => {
    const regionIndex = regions.findIndex((region) => region.id === branch.parentId);
    return {
      ...nodeFromBranch(branch),
      region: regionIndex >= 0 ? regionIndex + 1 : 1,
      avenue: index + 1,
    };
  });
  return asContinuation({
    root: {
      premise: root?.territory || model.chapterTitle,
      title: root?.title || model.chapterTitle,
      question: root?.question || "",
      territory: root?.territory || model.chapterTitle,
      observation: root?.observation || "",
    },
    regions: regions.map(nodeFromBranch),
    avenues: numberedAvenues,
    inquiries: inquiries.map((branch) => {
      const parent = sessionBranchById(model, branch.parentId);
      const regionIndex = regions.findIndex(
        (region) => region.id === parent?.parentId || region.id === branch.parentId,
      );
      const avenueIndex = avenues.findIndex((avenue) => avenue.id === branch.parentId);
      return {
        ...nodeFromBranch(branch),
        region: regionIndex >= 0 ? regionIndex + 1 : 1,
        avenue: avenueIndex >= 0 ? avenueIndex + 1 : 1,
      };
    }),
    regionFailures: 0,
    failed: [],
    settled: [],
    seedModel: model,
  });
}

async function growSeededSessionBranchModel(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
  continuation: SessionBranchContinuation;
}): Promise<
  | { ok: true; model: SessionBranchModel; continuation: SessionBranchContinuation; done: boolean }
  | { ok: false; error: string }
> {
  const model = hydrateSessionBranchModel(input.continuation.seedModel);
  if (!model) return { ok: false, error: "The field could not be prepared." };
  const parents = sessionBranchParentsNeedingGrowth(model, input.continuation.failed).slice(
    0,
    SESSION_BRANCH_CONTINUATION_BATCH,
  );
  if (!parents.length) {
    return {
      ok: true,
      model,
      continuation: { ...input.continuation, seedModel: model },
      done: true,
    };
  }
  const results = await mapWithConcurrency(parents, CONTINUE_CONCURRENCY, async (row) => {
    const siblings = model.branches.filter((branch) => branch.parentId === row.parent.id);
    const prepared = await generateSessionBranchChildren({
      chapterTitle: input.chapterTitle,
      chapterBrief: input.chapterBrief,
      parentTitle: row.parent.title,
      parentQuestion: row.parent.question,
      parentTerritory: row.parent.territory,
      siblingTitles: siblings.map((branch) => branch.title),
      count: row.need,
    });
    return {
      parentId: row.parent.id,
      children: prepared.ok ? prepared.children : [],
      failed: prepared.ok ? null : `seed:${row.parent.id}`,
    };
  });
  let next = model;
  const failed = [...input.continuation.failed];
  for (const result of results) {
    if (result.children.length) {
      next = addAuthorUnsysGeneratedChildren(next, result.parentId, result.children);
    }
    if (result.failed && !failed.includes(result.failed)) failed.push(result.failed);
  }
  const continuation = {
    ...input.continuation,
    failed,
    seedModel: next,
  };
  return {
    ok: true,
    model: next,
    continuation,
    done: sessionBranchParentsNeedingGrowth(next, failed).length === 0,
  };
}

/** The next slices still missing. One stage at a time: regions, then avenues, then inquiries. */
export function nextSessionBranchSlices(value: SessionBranchContinuation): ContinuationSlice[] {
  const continuation = asContinuation(value);
  const regionGap =
    SESSION_BRANCH_REGION_COUNT - continuation.regions.length - continuation.regionFailures;
  if (regionGap > 0) {
    return Array.from({ length: Math.min(SESSION_BRANCH_CONTINUATION_BATCH, regionGap) }, (_, index) => ({
      kind: "region" as const,
      ordinal: continuation.regions.length + continuation.regionFailures + index + 1,
    }));
  }
  const avenueSlices: ContinuationSlice[] = [];
  for (let index = 0; index < continuation.regions.length; index += 1) {
    const regionNumber = index + 1;
    const have = continuation.avenues.filter((avenue) => numberOf(avenue.region) === regionNumber).length;
    if (have >= SESSION_BRANCH_AVENUE_COUNT || continuation.settled.includes(`avenues:${regionNumber}`)) continue;
    if (continuation.failed.includes(`avenues:${regionNumber}`)) continue;
    avenueSlices.push({ kind: "avenues", regionNumber });
  }
  if (avenueSlices.length) return avenueSlices.slice(0, SESSION_BRANCH_CONTINUATION_BATCH);
  const inquirySlices: ContinuationSlice[] = [];
  for (let index = 0; index < continuation.regions.length; index += 1) {
    const regionNumber = index + 1;
    const avenues = continuation.avenues.filter((avenue) => numberOf(avenue.region) === regionNumber);
    for (let avenueOffset = 0; avenueOffset < avenues.length; avenueOffset += 2) {
      const avenueCount = Math.min(2, avenues.length - avenueOffset);
      const listed = avenues.slice(avenueOffset, avenueOffset + avenueCount);
      const have = continuation.inquiries.filter((inquiry) => {
        if (numberOf(inquiry.region) !== regionNumber) return false;
        const avenueNumber = numberOf(inquiry.avenue);
        return listed.some((avenue, avenueIndex) => {
          const stamped = numberOf(avenue.avenue) ?? avenueOffset + avenueIndex + 1;
          return avenueNumber === stamped;
        });
      }).length;
      const key = `inquiries:${regionNumber}:${avenueOffset}`;
      if (have >= avenueCount * SESSION_BRANCH_INQUIRY_COUNT || continuation.settled.includes(key)) continue;
      if (continuation.failed.includes(key)) continue;
      inquirySlices.push({ kind: "inquiries", regionNumber, avenueOffset, avenueCount });
    }
  }
  return inquirySlices.slice(0, SESSION_BRANCH_CONTINUATION_BATCH);
}

function modelFromContinuation(
  continuation: SessionBranchContinuation,
  chapterTitle: string,
): SessionBranchModel | null {
  if (!continuation.regions.length) return null;
  return normalizeSessionBranchModel(
    assembleSessionBranchDraft({
      root: continuation.root,
      regions: continuation.regions,
      avenues: continuation.avenues,
      inquiries: continuation.inquiries,
    }),
    chapterTitle,
  );
}

export async function generateSessionBranchOpening(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
}): Promise<
  | { ok: true; model: SessionBranchModel; continuation: SessionBranchContinuation }
  | { ok: false; error: string }
> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  if (!chapterTitle && !chapterBrief) {
    return { ok: false, error: "A chapter is required." };
  }
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };
  const reply = await ask(
    regionSchema(),
    [
      materialBlock(material),
      "Write the premise and exactly 1 region.",
      "Do not write avenues or inquiries in this reply.",
      "One region is enough to open the session. The others are written later.",
    ].join("\n\n"),
    OPENING_REGION_TOKENS,
  );
  if (!reply.ok) return reply;
  const regions = asList(reply.data.regions).slice(0, SESSION_BRANCH_REGION_COUNT);
  if (filled(regions) < 1 || !textOf(reply.data.premise)) {
    return { ok: false, error: "The field came back too small to work in." };
  }
  const continuation = asContinuation({
    ...emptySessionBranchContinuation(reply.data),
    regions,
  });
  const model = modelFromContinuation(continuation, material.chapterTitle);
  if (!model) return { ok: false, error: "The field came back too small to work in." };
  return { ok: true, model, continuation };
}

type SliceDelta = {
  region?: FieldNode | null;
  regionFailed?: boolean;
  avenues?: FieldNode[];
  inquiries?: FieldNode[];
  failedKey?: string;
  settledKey?: string;
};

async function writeContinuationSlice(
  continuation: SessionBranchContinuation,
  slice: ContinuationSlice,
  material: { chapterTitle: string; chapterBrief?: string | null },
): Promise<SliceDelta> {
  const next = asContinuation(continuation);
  if (slice.kind === "region") {
    const chosen = next.regions
      .map((region, index) => `${index + 1}. ${textOf(region.title)} — ${textOf(region.territory)}`)
      .join("\n");
    const reply = await ask(
      singleRegionSchema(),
      [
        materialBlock(material),
        chosen ? `Regions already chosen:\n${chosen}` : "",
        `Write exactly 1 more region. This is region ${slice.ordinal} of ${SESSION_BRANCH_REGION_COUNT}.`,
        "It must cover a different part of the chapter. Do not repeat a title above.",
        "Do not write avenues or inquiries.",
      ]
        .filter(Boolean)
        .join("\n\n"),
      2000,
    );
    const region = reply.ok ? asRecord(reply.data.region) : null;
    if (!region || !textOf(region.title) || !textOf(region.question) || !textOf(region.observation)) {
      return { regionFailed: true };
    }
    return { region };
  }
  if (slice.kind === "avenues") {
    const region = next.regions[slice.regionNumber - 1];
    const reply = await ask(
      avenueSchema(),
      [
        materialBlock(material),
        "Region already chosen:",
        `${slice.regionNumber}. ${textOf(region?.title)} — ${textOf(region?.territory)}`,
        `Write between ${SESSION_BRANCH_CHILD_MIN} and ${SESSION_BRANCH_AVENUE_COUNT} avenues for region ${slice.regionNumber}.`,
        "Choose how many avenues the concept needs. Do not pad.",
        `Set region to ${slice.regionNumber} on every avenue.`,
        "Avenues must diverge. Do not write inquiries in this reply.",
      ].join("\n\n"),
      tokensForNodes(SESSION_BRANCH_AVENUE_COUNT),
    );
    const avenues = reply.ok
      ? asList(reply.data.avenues).slice(0, SESSION_BRANCH_AVENUE_COUNT)
      : [];
    if (filled(avenues) < 1) return { failedKey: `avenues:${slice.regionNumber}` };
    return {
      settledKey: `avenues:${slice.regionNumber}`,
      avenues: avenues.map((avenue, index) => ({
        ...avenue,
        region: slice.regionNumber,
        avenue: index + 1,
      })),
    };
  }
  const listed = avenuesForSlice(
    next.avenues,
    slice.regionNumber,
    slice.avenueOffset,
    slice.avenueCount,
  ).map((avenue, index) => {
    const avenueNumber = numberOf(avenue.avenue) ?? slice.avenueOffset + index + 1;
    return {
      avenueNumber,
      line: `${slice.regionNumber}.${avenueNumber} ${textOf(avenue.title)} — ${textOf(avenue.territory)}`,
    };
  });
  const reply = await ask(
    inquirySchema(),
    [
      materialBlock(material),
      "Avenues to go further into:",
      listed.map((item) => item.line).join("\n"),
      `Write between ${SESSION_BRANCH_CHILD_MIN} and ${SESSION_BRANCH_INQUIRY_COUNT} inquiries for every avenue listed.`,
      "Choose how many inquiries each avenue needs. Do not pad.",
      "region is the first number and avenue is the second number. Copy both onto every inquiry for that avenue.",
      "An inquiry goes further into that avenue. It must not repeat the avenue title.",
    ].join("\n\n"),
    tokensForNodes(slice.avenueCount * SESSION_BRANCH_INQUIRY_COUNT),
  );
  const key = `inquiries:${slice.regionNumber}:${slice.avenueOffset}`;
  if (!reply.ok || filled(asList(reply.data.inquiries)) < 1) return { failedKey: key };
  const inquiries = asList(reply.data.inquiries).map((inquiry, index) => {
    const chunk = Math.min(Math.max(0, listed.length - 1), Math.floor(index / SESSION_BRANCH_INQUIRY_COUNT));
    return {
      ...inquiry,
      region: numberOf(inquiry.region) ?? slice.regionNumber,
      avenue: numberOf(inquiry.avenue) ?? listed[chunk]?.avenueNumber ?? null,
    };
  });
  return { inquiries, settledKey: key };
}

export async function continueSessionBranchModel(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
  continuation: SessionBranchContinuation;
}): Promise<
  | { ok: true; model: SessionBranchModel; continuation: SessionBranchContinuation; done: boolean }
  | { ok: false; error: string }
> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  if (!chapterTitle && !chapterBrief) return { ok: false, error: "A chapter is required." };
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };
  let continuation = asContinuation(input.continuation);
  if (continuation.seedModel) {
    return growSeededSessionBranchModel({
      chapterTitle: material.chapterTitle,
      chapterBrief: material.chapterBrief,
      continuation,
    });
  }
  const slices = nextSessionBranchSlices(continuation);
  if (!slices.length) {
    const model = modelFromContinuation(continuation, material.chapterTitle);
    if (!model) return { ok: false, error: "The field came back too small to work in." };
    return { ok: true, model, continuation, done: true };
  }
  const results = await mapWithConcurrency(slices, CONTINUE_CONCURRENCY, (slice) =>
    writeContinuationSlice(continuation, slice, material),
  );
  for (const result of results) {
    if (result.region) continuation.regions.push(result.region);
    if (result.regionFailed) continuation.regionFailures += 1;
    if (result.avenues?.length) continuation.avenues.push(...result.avenues);
    if (result.inquiries?.length) continuation.inquiries.push(...result.inquiries);
    if (result.failedKey && !continuation.failed.includes(result.failedKey)) {
      continuation.failed.push(result.failedKey);
    }
    if (result.settledKey && !continuation.settled.includes(result.settledKey)) {
      continuation.settled.push(result.settledKey);
    }
  }
  const model = modelFromContinuation(continuation, material.chapterTitle);
  if (!model) return { ok: false, error: "The field came back too small to work in." };
  return { ok: true, model, continuation, done: nextSessionBranchSlices(continuation).length === 0 };
}
