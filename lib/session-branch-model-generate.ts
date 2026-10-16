/**
 * Prepare a Learn session field with xAI.
 * There is no handwritten chapter tree. A short reply is refused.
 * The session opens after the premise and the first regions. The rest of the field
 * is written in small batches while the session is already on.
 * Avenues and inquiries stay in small slices so one call can finish inside the request timeout.
 */

import {
  extraCatalogActionIds,
  extraCatalogPriceKey,
  normalizeSessionBranchModel,
  SESSION_BRANCH_ACCEPT_COUNT,
  SESSION_BRANCH_AVENUE_COUNT,
  SESSION_BRANCH_INQUIRY_COUNT,
  SESSION_BRANCH_REGION_COUNT,
  SESSION_BRANCH_TARGET_COUNT,
  type SessionBranchDraft,
  type SessionBranchModel,
} from "@/lib/session-branch-model";
import { parseLearningModelSize, type LearningModelSize } from "@/lib/learning-model";
import { callXai, systemMessage, userMessage, type JsonSchema } from "@/lib/xai-client";

export type SessionBranchGenerateResult =
  | { ok: true; model: SessionBranchModel }
  | { ok: false; error: string };

const STORED_NODE_KEYS = [
  "title",
  "question",
  "territory",
  "observation",
  "closePrice",
  "keepPrice",
  "discardPrice",
  "insightPrice",
  "closeLeads",
  "keepLeads",
  "discardLeads",
  "insightLeads",
  "closeObservation",
  "keepObservation",
  "discardObservation",
  "insightObservation",
] as const;

function nodeKeysForCatalog(size: LearningModelSize): string[] {
  return [
    ...STORED_NODE_KEYS,
    ...extraCatalogActionIds(size).map((id) => extraCatalogPriceKey(id)),
  ];
}

function systemForCatalog(size: LearningModelSize): string {
  const extra = extraCatalogActionIds(size);
  const extraLine = extra.length
    ? `Also set ${extra.map((id) => extraCatalogPriceKey(id)).join(", ")} from 0 to 100. Those are the extra catalog actions on this ${size}-action generative model.`
    : "";
  return [
    "You write one slice of a session field as JSON.",
    "Every title is a short phrase.",
    "Every question is one original interrogative sentence a learner would be asked. Write it from scratch. Never wrap the title or territory into a stock sentence.",
    "Every territory, observation, leads line, and action observation is one or two complete sentences about this chapter.",
    "Prices are numbers from 0 to 100. A lower price is the better next policy on that node.",
    "Close is cheap when the observation would settle the node. Keep is cheap when a further observation is still needed. Discard is cheap on a dead end. Insight is expensive until the territory is settled.",
    extraLine,
    "No headings, no bullets, no product names.",
  ]
    .filter(Boolean)
    .join(" ");
}

function nodeProperties(
  size: LearningModelSize,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  const properties: Record<string, unknown> = { ...extra };
  for (const key of nodeKeysForCatalog(size)) {
    properties[key] = key.endsWith("Price") ? { type: "number" } : { type: "string" };
  }
  return properties;
}

function nodeRequired(size: LearningModelSize, extra: string[] = []): string[] {
  return [...extra, ...nodeKeysForCatalog(size)];
}

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

function storedRootProperties(size: LearningModelSize): Record<string, unknown> {
  const properties: Record<string, unknown> = {
    premise: { type: "string" },
    closePrice: { type: "number" },
    keepPrice: { type: "number" },
    discardPrice: { type: "number" },
    insightPrice: { type: "number" },
    closeLeads: { type: "string" },
    keepLeads: { type: "string" },
    discardLeads: { type: "string" },
    insightLeads: { type: "string" },
    closeObservation: { type: "string" },
    keepObservation: { type: "string" },
    discardObservation: { type: "string" },
    insightObservation: { type: "string" },
  };
  for (const id of extraCatalogActionIds(size)) {
    properties[extraCatalogPriceKey(id)] = { type: "number" };
  }
  return properties;
}

function storedRootRequired(size: LearningModelSize): string[] {
  return [
    "premise",
    "closePrice",
    "keepPrice",
    "discardPrice",
    "insightPrice",
    "closeLeads",
    "keepLeads",
    "discardLeads",
    "insightLeads",
    "closeObservation",
    "keepObservation",
    "discardObservation",
    "insightObservation",
    ...extraCatalogActionIds(size).map((id) => extraCatalogPriceKey(id)),
  ];
}

function regionSchema(size: LearningModelSize): JsonSchema {
  return objectSchema(
    "session_branch_regions",
    [...storedRootRequired(size), "regions"],
    {
      ...storedRootProperties(size),
      regions: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          required: nodeRequired(size),
          properties: nodeProperties(size),
        },
      },
    },
  );
}

function avenueSchema(size: LearningModelSize): JsonSchema {
  return objectSchema("session_branch_avenues", ["avenues"], {
    avenues: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: nodeRequired(size, ["region"]),
        properties: nodeProperties(size, { region: { type: "number" } }),
      },
    },
  });
}

function singleRegionSchema(size: LearningModelSize): JsonSchema {
  return objectSchema("session_branch_region", ["region"], {
    region: {
      type: "object",
      additionalProperties: false,
      required: nodeRequired(size),
      properties: nodeProperties(size),
    },
  });
}

function inquirySchema(size: LearningModelSize): JsonSchema {
  return objectSchema("session_branch_inquiries", ["inquiries"], {
    inquiries: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        required: nodeRequired(size, ["region", "avenue"]),
        properties: nodeProperties(size, {
          region: { type: "number" },
          avenue: { type: "number" },
        }),
      },
    },
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
  size: LearningModelSize,
  schema: JsonSchema,
  prompt: string,
  maxTokens: number,
): Promise<{ ok: true; data: FieldNode } | { ok: false; error: string }> {
  const response = await callXai<FieldNode>(
    [systemMessage(systemForCatalog(size)), userMessage(prompt)],
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
  return filled(asList(data.regions ?? data.avenues ?? data.inquiries));
}

async function askUntil(
  size: LearningModelSize,
  schema: JsonSchema,
  prompt: string,
  maxTokens: number,
  accept: (data: FieldNode) => boolean,
): Promise<{ ok: true; data: FieldNode } | { ok: false; error: string }> {
  const first = await ask(size, schema, prompt, maxTokens);
  if (!first.ok) return first;
  if (accept(first.data)) return first;
  const second = await ask(
    size,
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

export async function generateSessionBranchModel(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
  catalogSize?: unknown;
}): Promise<SessionBranchGenerateResult> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  const catalogSize = parseLearningModelSize(input.catalogSize);
  if (!chapterTitle && !chapterBrief) {
    return { ok: false, error: "A chapter is required." };
  }
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };

  const regionsReply = await askUntil(
    catalogSize,
    regionSchema(catalogSize),
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
      catalogSize,
      avenueSchema(catalogSize),
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
      catalogSize,
      inquirySchema(catalogSize),
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
  const model = normalizeSessionBranchModel(draft, material.chapterTitle, catalogSize);
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
  catalogSize: LearningModelSize;
};

type ContinuationSlice =
  | { kind: "region"; ordinal: number }
  | { kind: "avenues"; regionNumber: number }
  | { kind: "inquiries"; regionNumber: number; avenueOffset: number; avenueCount: number };

export function emptySessionBranchContinuation(
  root: Record<string, unknown>,
  catalogSize: unknown = 4,
): SessionBranchContinuation {
  return {
    root,
    regions: [],
    avenues: [],
    inquiries: [],
    regionFailures: 0,
    failed: [],
    settled: [],
    catalogSize: parseLearningModelSize(catalogSize),
  };
}

function asContinuation(value: SessionBranchContinuation | null | undefined): SessionBranchContinuation {
  return {
    root: asRecord(value?.root) ?? {},
    regions: asList(value?.regions),
    avenues: asList(value?.avenues),
    inquiries: asList(value?.inquiries),
    regionFailures: Math.max(0, Number(value?.regionFailures) || 0),
    failed: Array.isArray(value?.failed) ? value.failed.filter((item) => typeof item === "string") : [],
    settled: Array.isArray(value?.settled) ? value.settled.filter((item) => typeof item === "string") : [],
    catalogSize: parseLearningModelSize(value?.catalogSize),
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
    continuation.catalogSize,
  );
}

export async function generateSessionBranchOpening(input: {
  chapterTitle: string;
  chapterBrief?: string | null;
  catalogSize?: unknown;
}): Promise<
  | { ok: true; model: SessionBranchModel; continuation: SessionBranchContinuation }
  | { ok: false; error: string }
> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  const catalogSize = parseLearningModelSize(input.catalogSize);
  if (!chapterTitle && !chapterBrief) {
    return { ok: false, error: "A chapter is required." };
  }
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };
  const reply = await ask(
    catalogSize,
    regionSchema(catalogSize),
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
    ...emptySessionBranchContinuation(reply.data, catalogSize),
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
  const catalogSize = next.catalogSize;
  if (slice.kind === "region") {
    const chosen = next.regions
      .map((region, index) => `${index + 1}. ${textOf(region.title)} — ${textOf(region.territory)}`)
      .join("\n");
    const reply = await ask(
      catalogSize,
      singleRegionSchema(catalogSize),
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
      catalogSize,
      avenueSchema(catalogSize),
      [
        materialBlock(material),
        "Region already chosen:",
        `${slice.regionNumber}. ${textOf(region?.title)} — ${textOf(region?.territory)}`,
        `Write exactly ${SESSION_BRANCH_AVENUE_COUNT} avenues for region ${slice.regionNumber}.`,
        `Set region to ${slice.regionNumber} on every avenue.`,
        "Avenues must diverge. Do not write inquiries in this reply.",
      ].join("\n\n"),
      tokensForNodes(SESSION_BRANCH_AVENUE_COUNT),
    );
    const avenues = reply.ok ? asList(reply.data.avenues).slice(0, SESSION_BRANCH_AVENUE_COUNT) : [];
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
    catalogSize,
    inquirySchema(catalogSize),
    [
      materialBlock(material),
      "Avenues to go further into:",
      listed.map((item) => item.line).join("\n"),
      `Write exactly ${SESSION_BRANCH_INQUIRY_COUNT} inquiries for every avenue listed.`,
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
  catalogSize?: unknown;
  continuation: SessionBranchContinuation;
}): Promise<
  | { ok: true; model: SessionBranchModel; continuation: SessionBranchContinuation; done: boolean }
  | { ok: false; error: string }
> {
  const chapterTitle = textOf(input.chapterTitle);
  const chapterBrief = textOf(input.chapterBrief);
  if (!chapterTitle && !chapterBrief) return { ok: false, error: "A chapter is required." };
  const material = { chapterTitle: chapterTitle || chapterBrief, chapterBrief };
  let continuation = asContinuation({
    ...input.continuation,
    catalogSize: parseLearningModelSize(input.catalogSize ?? input.continuation.catalogSize),
  });
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
