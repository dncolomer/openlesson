import { describe, expect, it } from "vitest";
import { BEHAVIOR_SCHEMA, BEHAVIOR_TOOL_NAME, envelopeBehaviorSample } from "@/lib/behavior-capture";
import { BEHAVIOR_ROLLUP_ACTION, BEHAVIOR_ROLLUP_SCHEMA } from "@/lib/behavior-capture-rollup";
import {
  RECORD_MAX_SAMPLES_PER_STREAM,
  loadStoredRecordBodies,
  parseBehaviorJsonl,
  presentStoredRecord,
  shouldHydrateStoredRecordFile,
  storedRecordFileKind,
} from "@/lib/behavior-record";

const FILE_PATH = "/api/dashboard/knowledge-regions/file";

function jsonl(samples: ReturnType<typeof envelopeBehaviorSample>[]): string {
  return samples.map((sample) => JSON.stringify(sample)).join("\n") + "\n";
}

describe("stored record presenter", () => {
  it("groups hydrated JSONL by stream and keeps screen stills as file hrefs", () => {
    const pointer = envelopeBehaviorSample({
      t: 10,
      sid: "s1",
      hid: "h1",
      seq: 1,
      stream: "pointer",
      body: { x: 1.2, y: 3.4, button: "down" },
    });
    const speech = envelopeBehaviorSample({
      t: 20,
      sid: "s1",
      hid: "h1",
      seq: 2,
      stream: "speech",
      body: { text: "hello", is_final: true, char_count: 5 },
    });
    const view = presentStoredRecord({
      filePath: FILE_PATH,
      bodies: {
        "file_chunk": jsonl([pointer, speech]),
        "file_rollup": JSON.stringify({
          schema: BEHAVIOR_ROLLUP_SCHEMA,
          session_id: "s1",
          streams: [{ stream: "pointer", xai_file_id: "file_chunk", sample_count: 1 }],
          counts: { pointer: 1, speech: 1 },
        }),
      },
      rows: [
        {
          type: "tool",
          tool_name: BEHAVIOR_TOOL_NAME,
          tool_action: "chunk",
          timestamp_ms: 20,
          payload: "pointer-s1-10-0.jsonl",
          xai_file_id: "file_chunk",
          mime_type: "application/json",
          metadata: { schema: BEHAVIOR_SCHEMA, streams: ["pointer", "speech"], sample_count: 2 },
        },
        {
          type: "tool",
          tool_name: BEHAVIOR_TOOL_NAME,
          tool_action: BEHAVIOR_ROLLUP_ACTION,
          timestamp_ms: 21,
          payload: "behavior-rollup-s1.json",
          xai_file_id: "file_rollup",
          mime_type: "application/json",
          metadata: { schema: BEHAVIOR_ROLLUP_SCHEMA },
        },
        {
          type: "screen",
          tool_name: null,
          tool_action: null,
          timestamp_ms: 15,
          payload: "shot.png",
          xai_file_id: "file_shot",
          mime_type: "image/png",
          file_size: 1200,
          metadata: { sensor_kind: "screen" },
        },
      ],
    });

    expect(view.sample_count).toBe(2);
    expect(view.streams.map((stream) => stream.stream)).toEqual(["pointer", "speech"]);
    expect(view.streams[0]?.samples[0]?.body).toEqual({ x: 1.2, y: 3.4, button: "down" });
    expect(view.streams[1]?.samples[0]?.body).toMatchObject({ text: "hello", is_final: true });
    expect(view.rollup?.schema).toBe(BEHAVIOR_ROLLUP_SCHEMA);
    expect(view.files.map((file) => file.kind)).toEqual(["behavior_chunk", "rollup", "screen"]);
    expect(view.files[2]?.href).toBe(`${FILE_PATH}?fileId=file_shot`);
    expect(view.files[2]?.hydrated).toBe(false);
  });

  it("caps per-stream samples and skips person media / canvas PNG wrappers", () => {
    const lines = Array.from({ length: RECORD_MAX_SAMPLES_PER_STREAM + 5 }, (_, i) =>
      envelopeBehaviorSample({
        t: i,
        sid: "s1",
        seq: i,
        stream: "hover",
        body: { x: i, y: 0 },
      }),
    );
    const view = presentStoredRecord({
      filePath: FILE_PATH,
      bodies: { "file_hover": jsonl(lines) },
      rows: [
        {
          type: "tool",
          tool_name: BEHAVIOR_TOOL_NAME,
          tool_action: "chunk",
          xai_file_id: "file_hover",
          mime_type: "application/json",
          payload: "hover.jsonl",
        },
        {
          type: "video",
          tool_name: "webcam",
          xai_file_id: "file_vid",
          mime_type: "video/webm",
          payload: "clip.webm",
        },
        {
          type: "tool",
          tool_name: "canvas",
          tool_action: "canvas_draw",
          xai_file_id: "file_canvas",
          mime_type: "application/json",
          payload: "ile-canvas.json",
        },
      ],
    });
    expect(view.truncated).toBe(true);
    expect(view.streams[0]?.shown).toBe(RECORD_MAX_SAMPLES_PER_STREAM);
    expect(view.streams[0]?.count).toBe(RECORD_MAX_SAMPLES_PER_STREAM + 5);
    expect(storedRecordFileKind({ type: "video", mime_type: "video/webm" })).toBe("person_media");
    expect(view.files.find((file) => file.kind === "person_media")?.href).toBeNull();
    expect(shouldHydrateStoredRecordFile({
      type: "tool",
      tool_name: "canvas",
      tool_action: "canvas_draw",
      xai_file_id: "file_canvas",
      mime_type: "application/json",
    })).toBe(false);
  });

  it("loads behavior files before other JSON and parses jsonl lines", async () => {
    const sample = envelopeBehaviorSample({
      t: 1,
      sid: "s",
      seq: 0,
      stream: "unsys",
      body: { hid: "n1" },
    });
    expect(parseBehaviorJsonl(jsonl([sample]))).toHaveLength(1);
    const order: string[] = [];
    const bodies = await loadStoredRecordBodies(
      [
        { type: "tool", tool_name: "other", xai_file_id: "file_other", mime_type: "application/json" },
        { type: "tool", tool_name: BEHAVIOR_TOOL_NAME, xai_file_id: "file_beh", mime_type: "application/json" },
      ],
      async (id) => {
        order.push(id);
        return "{}";
      },
    );
    expect(order[0]).toBe("file_beh");
    expect(Object.keys(bodies).sort()).toEqual(["file_beh", "file_other"]);
  });
});
