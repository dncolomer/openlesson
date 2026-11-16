import { afterEach, describe, expect, it } from "vitest";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { readRepo } from "../helpers/surface-source";
import {
  createMemoryBlobStore,
  getBlobStore,
  setBlobStoreForTests,
} from "@/lib/ai/blob-store";
import { getChatConfig, chatCompletionsUrl } from "@/lib/ai/chat";
import {
  getDocumentContext,
  setDocumentContextForTests,
} from "@/lib/ai/document-context";
import { createFilesystemBlobStore } from "@/lib/ai/fs-blob-store";
import { isStoredFileId } from "@/lib/ai/stored-file-id";
import { getProviderInfo } from "@/lib/xai-client";
import { isFlowArtifactFileId } from "@/lib/flow-artifacts";

describe("BlobStore memory adapter", () => {
  afterEach(() => {
    setBlobStoreForTests(null);
  });

  it("puts, gets, exists, and deletes bytes", async () => {
    const store = createMemoryBlobStore();
    setBlobStoreForTests(store);
    const put = await getBlobStore().put({
      name: "note.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("hello").toString("base64"),
    });
    expect(put.id).toMatch(/^mem_/);
    expect(await getBlobStore().exists(put.id)).toBe(true);
    const got = await getBlobStore().get(put.id);
    expect(got.status).toBe(200);
    expect(Buffer.from(got.bytes).toString("utf8")).toBe("hello");
    expect(got.mimeType).toBe("text/plain");
    expect(await getBlobStore().delete(put.id)).toBe(true);
    expect(await getBlobStore().exists(put.id)).toBe(false);
  });
});

describe("Filesystem BlobStore", () => {
  it("puts, gets, exists, and deletes bytes on disk", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ol-blobs-"));
    try {
      const store = createFilesystemBlobStore(dir);
      const put = await store.put({
        name: "note.txt",
        mimeType: "text/plain",
        bytes: Buffer.from("disk-hello"),
      });
      expect(put.id).toMatch(/^fs_/);
      expect(isStoredFileId(put.id)).toBe(true);
      expect(await store.exists(put.id)).toBe(true);
      const got = await store.get(put.id);
      expect(got.status).toBe(200);
      expect(got.name).toBe("note.txt");
      expect(Buffer.from(got.bytes).toString("utf8")).toBe("disk-hello");
      expect(await store.delete(put.id)).toBe(true);
      expect(await store.exists(put.id)).toBe(false);
    } finally {
      await fs.rm(dir, { recursive: true, force: true });
    }
  });

  it("getBlobStore uses BLOB_STORE=fs", async () => {
    const dir = await fs.mkdtemp(path.join(os.tmpdir(), "ol-blobs-"));
    const prevKind = process.env.BLOB_STORE;
    const prevDir = process.env.BLOB_STORE_DIR;
    process.env.BLOB_STORE = "fs";
    process.env.BLOB_STORE_DIR = dir;
    setBlobStoreForTests(null);
    try {
      const put = await getBlobStore().put({
        name: "a.txt",
        mimeType: "text/plain",
        bytes: Buffer.from("via-factory"),
      });
      expect(put.id).toMatch(/^fs_/);
      const got = await getBlobStore().get(put.id);
      expect(Buffer.from(got.bytes).toString("utf8")).toBe("via-factory");
    } finally {
      if (prevKind === undefined) delete process.env.BLOB_STORE;
      else process.env.BLOB_STORE = prevKind;
      if (prevDir === undefined) delete process.env.BLOB_STORE_DIR;
      else process.env.BLOB_STORE_DIR = prevDir;
      await fs.rm(dir, { recursive: true, force: true });
    }
  });
});

describe("DocumentContext", () => {
  const prevKind = process.env.BLOB_STORE;

  afterEach(() => {
    setBlobStoreForTests(null);
    setDocumentContextForTests(null);
    if (prevKind === undefined) delete process.env.BLOB_STORE;
    else process.env.BLOB_STORE = prevKind;
  });

  it("portable adapter extracts text into extraPrompt", async () => {
    const store = createMemoryBlobStore();
    setBlobStoreForTests(store);
    process.env.BLOB_STORE = "memory";
    const put = await store.put({
      name: "brief.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("Decode the chain"),
    });
    const turn = await getDocumentContext().forTurn([put.id]);
    expect(turn.responsesFiles).toBeUndefined();
    expect(turn.extraPrompt).toContain("Decode the chain");
    expect(turn.extraPrompt).toContain("brief.txt");
  });

  it("xAI adapter keeps Responses file ids and extracts other ids", async () => {
    const store = createMemoryBlobStore();
    setBlobStoreForTests(store);
    process.env.BLOB_STORE = "xai";
    const put = await store.put({
      name: "note.txt",
      mimeType: "text/plain",
      bytes: Buffer.from("local excerpt"),
    });
    const xaiId = "file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
    const turn = await getDocumentContext().forTurn([xaiId, put.id]);
    expect(turn.responsesFiles).toEqual([xaiId]);
    expect(turn.extraPrompt).toContain("local excerpt");
  });
});

describe("isStoredFileId", () => {
  it("accepts xAI, filesystem, and memory ids", () => {
    expect(isStoredFileId("file_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
    expect(isStoredFileId("fs_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
    expect(isStoredFileId("mem_1")).toBe(true);
    expect(isStoredFileId("not-a-file")).toBe(false);
    expect(isFlowArtifactFileId("fs_aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee")).toBe(true);
  });

  it("keeps identity checks off the xAI Files client (Edge middleware)", () => {
    const src = readRepo("lib/ai/stored-file-id.ts");
    expect(src).not.toContain("@/lib/xai-files");
    expect(src).not.toContain("@/lib/xai-context");
    expect(src).not.toContain("process.versions");
    expect(readRepo("lib/xai-context.ts")).not.toContain("process.versions");
  });
});

describe("Chat config", () => {
  const envKeys = [
    "AI_BASE_URL",
    "AI_API_KEY",
    "AI_MODEL",
    "XAI_API_KEY",
  ] as const;
  const snapshot = Object.fromEntries(
    envKeys.map((key) => [key, process.env[key]]),
  );

  afterEach(() => {
    for (const key of envKeys) {
      const value = snapshot[key];
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  it("defaults to xAI chat completions when AI_* is unset", () => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.AI_MODEL;
    process.env.XAI_API_KEY = "xai-test-key";
    const cfg = getChatConfig();
    expect(cfg.baseURL).toBe("https://api.x.ai/v1");
    expect(cfg.apiKey).toBe("xai-test-key");
    expect(cfg.model).toBe("grok-4.5");
    expect(chatCompletionsUrl()).toBe("https://api.x.ai/v1/chat/completions");
    const info = getProviderInfo();
    expect(info.provider).toBe("xai");
    expect(info.hasXAIKey).toBe(true);
    expect(info.chatUrl).toBe("https://api.x.ai/v1/chat/completions");
  });

  it("reads OpenAI-compatible AI_BASE_URL / AI_API_KEY / AI_MODEL", () => {
    process.env.AI_BASE_URL = "http://localhost:11434/v1/";
    process.env.AI_API_KEY = "ollama";
    process.env.AI_MODEL = "llama3";
    const cfg = getChatConfig();
    expect(cfg.baseURL).toBe("http://localhost:11434/v1");
    expect(cfg.apiKey).toBe("ollama");
    expect(cfg.model).toBe("llama3");
    expect(getProviderInfo().provider).toBe("openai-compatible");
    expect(getProviderInfo().defaultModel).toBe("llama3");
  });
});
