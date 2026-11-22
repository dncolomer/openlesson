import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  BEHAVIOR_SCHEMA,
  BEHAVIOR_TOOL_NAME,
  PERSON_MEDIA_REFUSED,
  assertNoPersonMedia,
  buildBehaviorUploadItem,
  envelopeBehaviorSample,
  quantizeCoord,
} from "@/lib/behavior-capture";
import {
  BEHAVIOR_MAX_PENDING,
  BehaviorChunker,
} from "@/lib/behavior-capture-chunk";
import { saveAudioChunk, saveSessionAudio } from "@/lib/storage/media";
import { proofOfWorkTypeForSensor, sensorPowInsertPayload } from "@/lib/session-sensor-pow";

const ROOT = join(__dirname, "../..");

describe("behavior sample envelope", () => {
  it("stamps t, sid, hid, seq, stream", () => {
    const sample = envelopeBehaviorSample({
      t: 12,
      sid: "sid-1",
      hid: "hid-1",
      seq: 3,
      stream: "pointer",
      body: { x: 1.2, y: 3.4 },
    });
    expect(sample).toEqual({
      t: 12,
      sid: "sid-1",
      hid: "hid-1",
      seq: 3,
      stream: "pointer",
      x: 1.2,
      y: 3.4,
    });
  });
});

describe("assertNoPersonMedia", () => {
  it("rejects audio and video bytes", () => {
    expect(() => assertNoPersonMedia({ mimeType: "audio/webm" })).toThrow(PERSON_MEDIA_REFUSED);
    expect(() => assertNoPersonMedia({ mimeType: "video/mp4" })).toThrow(PERSON_MEDIA_REFUSED);
    expect(() => assertNoPersonMedia({ proof_of_work_type: "video" })).toThrow(PERSON_MEDIA_REFUSED);
    expect(() => assertNoPersonMedia({ payload: "data:audio/wav;base64,AAAA" })).toThrow(PERSON_MEDIA_REFUSED);
    expect(() => assertNoPersonMedia({ fileName: "clip.webm" })).toThrow(PERSON_MEDIA_REFUSED);
  });

  it("accepts JSON transcripts and PNG screen stills", () => {
    expect(() =>
      assertNoPersonMedia({
        mimeType: "application/json",
        kind: "tool",
        payload: JSON.stringify({ text: "hello", is_final: true }),
        fileName: "speech.json",
      }),
    ).not.toThrow();
    expect(() =>
      assertNoPersonMedia({
        mimeType: "image/png",
        proof_of_work_type: "screen",
        fileName: "shot.png",
      }),
    ).not.toThrow();
  });
});

describe("buildBehaviorUploadItem", () => {
  it("builds a tool JSON chunk with behavior-v0 metadata", () => {
    const item = buildBehaviorUploadItem({
      sessionId: "sess-1",
      chunk: {
        t0: 10,
        t1: 20,
        sampleCount: 2,
        chunkIndex: 0,
        bytes: 40,
        jsonl: '{"t":10,"sid":"sess-1","hid":null,"seq":0,"stream":"hover"}\n{"t":20,"sid":"sess-1","hid":null,"seq":1,"stream":"hover"}',
        streams: ["hover"],
      },
    });
    expect(item.kind).toBe("tool");
    expect(item.mimeType).toBe("application/json");
    expect(item.toolName).toBe(BEHAVIOR_TOOL_NAME);
    expect(item.metadata?.schema).toBe(BEHAVIOR_SCHEMA);
    expect(item.metadata?.stream).toBe("hover");
    expect(item.fileName).toBe("hover-sess-1-10-0.jsonl");
  });
});

describe("BehaviorChunker", () => {
  it("rotates before the open-byte cap and flush-and-drop leaves 0 open bytes", () => {
    const chunker = new BehaviorChunker({
      sessionId: "s1",
      maxOpenBytes: 400,
      maxOpenMs: 60_000,
      maxPending: 8,
    });
    for (let i = 0; i < 50; i++) {
      chunker.append({ t: i, stream: "hover", body: { x: i, y: 0 } });
    }
    expect(chunker.openByteLength).toBeLessThanOrEqual(400);
    expect(chunker.pendingCount).toBeGreaterThan(0);
    const flushed = chunker.flush();
    expect(flushed).not.toBeNull();
    expect(chunker.openByteLength).toBe(0);
    expect(chunker.openSampleCount).toBe(0);
    while (chunker.takePending()) {
      /* drop */
    }
    expect(chunker.pendingCount).toBe(0);
  });

  it("keeps open bytes under the cap across 10k hover samples", () => {
    const chunker = new BehaviorChunker({
      sessionId: "s1",
      maxOpenBytes: 800,
      maxOpenMs: 60_000,
      maxPending: BEHAVIOR_MAX_PENDING,
    });
    for (let i = 0; i < 10_000; i++) {
      chunker.append({ t: i, stream: "hover", body: { x: i, y: 1 } });
    }
    expect(chunker.openByteLength).toBeLessThanOrEqual(800);
    expect(chunker.pendingCount).toBeLessThanOrEqual(BEHAVIOR_MAX_PENDING);
  });

  it("drops hover under backpressure and still records pointer_edge", () => {
    const chunker = new BehaviorChunker({
      sessionId: "s1",
      maxOpenBytes: 120,
      maxOpenMs: 60_000,
      maxPending: 2,
    });
    for (let i = 0; i < 40; i++) {
      chunker.append({ t: i, stream: "hover", body: { x: i } });
    }
    chunker.markUploadStart();
    chunker.markUploadStart();
    const hover = chunker.append({ t: 100, stream: "hover", body: { x: 9 } });
    expect(hover.dropped).toBe(true);
    expect(hover.accepted).toBe(false);
    const edge = chunker.append({ t: 101, stream: "pointer_edge", body: { type: "up" } });
    expect(edge.accepted).toBe(true);
    chunker.flush();
    const lines: string[] = [];
    let next = chunker.takePending();
    while (next) {
      lines.push(next.jsonl);
      next = chunker.takePending();
    }
    expect(lines.join("\n")).toContain('"stream":"pointer_edge"');
  });
});

describe("learner person A/V ban", () => {
  it("refuses sensor audio → stored video", () => {
    expect(() => proofOfWorkTypeForSensor("audio")).toThrow(PERSON_MEDIA_REFUSED);
    expect(() =>
      sensorPowInsertPayload({
        sessionId: "s1",
        userId: "u1",
        workspaceId: "w1",
        kind: "audio",
        xaiFileId: "file-1",
        mimeType: "audio/webm",
      }),
    ).toThrow(PERSON_MEDIA_REFUSED);
  });

  it("refuses saveSessionAudio and saveAudioChunk", async () => {
    await expect(saveSessionAudio("s1", new Blob(["x"], { type: "audio/webm" }))).rejects.toThrow(
      PERSON_MEDIA_REFUSED,
    );
    await expect(saveAudioChunk("s1", new Blob(["x"], { type: "audio/webm" }), 0, 1)).rejects.toThrow(
      PERSON_MEDIA_REFUSED,
    );
  });
});

describe("behavior capture sources", () => {
  it("does not call Excalidraw serialize or export APIs", () => {
    const capture = readFileSync(join(ROOT, "lib/behavior-capture.ts"), "utf8");
    const chunk = readFileSync(join(ROOT, "lib/behavior-capture-chunk.ts"), "utf8");
    for (const src of [capture, chunk]) {
      expect(src).not.toContain("exportToBlob");
      expect(src).not.toContain("serializeAsJSON");
    }
  });
});

describe("quantizeCoord", () => {
  it("keeps one decimal", () => {
    expect(quantizeCoord(12.345)).toBe(12.3);
  });
});
