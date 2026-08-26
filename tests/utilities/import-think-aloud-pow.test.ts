/**
 * ILE Explore Solo think-aloud importer — drives shipped timeline, S2 apply, persist-map.
 */
import { describe, expect, it } from "vitest";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import {
  ILE_CHAT_TOOL_NAME,
  ILE_IDLE_TOOL_NAME,
  ILE_SPEECH_TOOL_NAME,
  ILE_TRACE_TOOL_NAME,
} from "@/lib/ile-thought-traces";
import { TAP_SPEECH_TOOL_NAME } from "@/lib/tap-speech-proof-of-work";
import { TAP_TRACE_TOOL_NAME, TAP_CHAT_TOOL_NAME } from "@/lib/tap-score-traces";
import { TAP_IDLE_TOOL_NAME } from "@/lib/tap-idle-proof-of-work";
import { ILE_END_OF_CHAIN_OF_THOUGHT_ACTION } from "@/lib/ile-im-done-answering";
import {
  ILE_IMPORT_AUTO_STASH_MS,
  ILE_IMPORT_IDLE_MS,
  ILE_IMPORT_SPEECH_GAP_MS,
  applySystem2Inference,
  buildIleSoloTimeline,
  mapIleSoloEventsToUploadInputs,
  parseSystem2Inference,
} from "@/utilities/import-think-aloud-pow";
import type { IleSoloThoughtEvent, IleSoloTimelineEvent } from "@/utilities/import-think-aloud-pow/types";

const ROOT = join(__dirname, "../..");
const SCRATCH =
  process.env.GROK_GOAL_SCRATCH ||
  "/var/folders/kd/98qlvkyd4mb3_9t32p9bmt_r0000gn/T/grok-goal-a1bb2984a842/implementer";
const PERSIST_MAP = join(ROOT, "utilities/import-think-aloud-pow/persist-map.ts");
const TRANSCRIPT_FIXTURE = join(ROOT, "tests/fixtures/think-aloud-transcript.json");
const WAV_FIXTURE = join(ROOT, "tests/fixtures/think-aloud-silent.wav");
const CONTEXT = {
  workspaceId: "ws-ile-solo-import",
  sessionId: "sess-ile-solo-import",
  blockId: "block-1",
};

function decodePayload(data: string): Record<string, unknown> {
  return JSON.parse(Buffer.from(data, "base64").toString("utf8")) as Record<string, unknown>;
}

function thoughts(events: IleSoloTimelineEvent[]): IleSoloThoughtEvent[] {
  return events.filter((event): event is IleSoloThoughtEvent => event.kind === "thought");
}

describe("buildIleSoloTimeline (shipped)", () => {
  it("emits ILE speech start/stop, System 1 per utterance, auto-stash, idle, media timestamps", () => {
    const helloEnd = 0.2;
    const thereStart = helloEnd + (ILE_IMPORT_SPEECH_GAP_MS - 1) / 1000;
    const thereEnd = thereStart + 0.2;
    const nextStart = thereEnd + ILE_IMPORT_SPEECH_GAP_MS / 1000;
    const nextEnd = nextStart + 0.3;
    const committedStart = nextEnd + 4.0;
    const committedEnd = committedStart + 0.2;
    const waitStart = committedEnd + ILE_IMPORT_AUTO_STASH_MS / 1000;
    const waitEnd = waitStart + 0.2;
    const laterStart = waitEnd + 4.0;
    const laterEnd = laterStart + 0.2;
    const resumeStart = laterEnd + (ILE_IMPORT_IDLE_MS + 10_000) / 1000;
    const resumeEnd = resumeStart + 0.2;

    const events = buildIleSoloTimeline({
      duration: resumeEnd + 1,
      words: [
        { text: "hello", start: 0, end: helloEnd },
        { text: "there", start: thereStart, end: thereEnd },
        { text: "next", start: nextStart, end: nextEnd },
        { text: "committed", start: committedStart, end: committedEnd },
        { text: "wait", start: waitStart, end: waitEnd },
        { text: "later", start: laterStart, end: laterEnd },
        { text: "resume", start: resumeStart, end: resumeEnd },
      ],
    });

    const starts = events.filter((event) => event.kind === "speech_start");
    const stops = events.filter((event) => event.kind === "speech_stop");
    const s1 = thoughts(events).filter((event) => event.traceType === "system1");
    const idle = events.filter((event) => event.kind === "idle");

    expect(starts.length).toBe(stops.length);
    expect(starts.length).toBe(s1.length);
    expect(s1.length).toBeGreaterThanOrEqual(5);

    const firstStop = stops[0];
    expect(firstStop.kind).toBe("speech_stop");
    if (firstStop.kind === "speech_stop") {
      expect(firstStop.transcriptSnapshot).toMatch(/hello there/);
    }

    const splitThought = s1.find((event) => event.text === "next");
    expect(splitThought?.action).toBe("pause_finalize");
    expect(splitThought?.timestampMs).toBe(Math.round(nextEnd * 1000));

    const autoThought = s1.find((event) => event.text === "committed");
    expect(autoThought?.action).toBe("auto_stash");
    expect(autoThought?.timestampMs).toBe(Math.round(committedEnd * 1000));

    expect(idle.length).toBeGreaterThanOrEqual(1);
    expect(idle[0]?.timestampMs).toBe(Math.round(laterEnd * 1000) + ILE_IMPORT_IDLE_MS);
    if (idle[0]?.kind === "idle") {
      expect(idle[0].idleDurationMs).toBe(ILE_IMPORT_IDLE_MS);
    }

    expect(events.every((event) => event.timestampMs >= 0)).toBe(true);
    expect(thoughts(events).every((event) => event.traceType !== "system2")).toBe(true);
  });
});

describe("applySystem2Inference (shipped)", () => {
  it("promotes inferred commitments and end-of-chain; remaining stashes stay System 1", () => {
    const s1Events = buildIleSoloTimeline({
      duration: 12,
      words: [
        { text: "hmm", start: 0.2, end: 0.8 },
        { text: "force", start: 4.0, end: 4.4 },
        { text: "is", start: 4.5, end: 4.7 },
        { text: "mass", start: 4.8, end: 5.2 },
        { text: "times", start: 5.3, end: 5.6 },
        { text: "acceleration", start: 5.7, end: 6.4 },
        { text: "so", start: 9.0, end: 9.2 },
        { text: "I", start: 9.3, end: 9.4 },
        { text: "am", start: 9.45, end: 9.55 },
        { text: "done", start: 9.6, end: 9.9 },
      ],
    });
    const s1 = thoughts(s1Events).filter((event) => event.traceType === "system1");
    expect(s1.length).toBeGreaterThanOrEqual(3);
    const committed = s1.find((event) => /mass times acceleration/i.test(event.text));
    const done = s1.find((event) => /done/i.test(event.text));
    expect(committed).toBeTruthy();
    expect(done).toBeTruthy();

    const inference = parseSystem2Inference({
      promotions: [{ thought_id: committed!.thoughtId }],
      end_of_chain: {
        thought_ids: [committed!.thoughtId, done!.thoughtId],
        text: `${committed!.text}\n${done!.text}`,
      },
    });

    const applied = applySystem2Inference(s1Events, inference);
    const allThoughts = thoughts(applied);
    const s2 = allThoughts.filter((event) => event.traceType === "system2");
    const remainingS1 = allThoughts.filter((event) => event.traceType === "system1");

    expect(remainingS1.length).toBe(s1.length);
    expect(s2.some((event) => event.action === "send" && event.thoughtId === committed!.thoughtId)).toBe(
      true,
    );
    expect(s2.some((event) => event.action === ILE_END_OF_CHAIN_OF_THOUGHT_ACTION)).toBe(true);
    expect(applied.some((event) => event.kind === "thought" && event.action === "send")).toBe(true);

    const hmm = remainingS1.find((event) => event.text === "hmm");
    expect(hmm?.traceType).toBe("system1");
    expect(s2.some((event) => event.thoughtId === hmm?.thoughtId && event.action === "send")).toBe(false);
  });
});

describe("mapIleSoloEventsToUploadInputs (shipped)", () => {
  it("maps ILE tool payloads, stills as screen, never speech/TAP/Helios/snapshot", () => {
    const events = applySystem2Inference(
      buildIleSoloTimeline({
        duration: 70,
        words: [
          { text: "working", start: 0.1, end: 0.6 },
          { text: "answer", start: 6.0, end: 6.5 },
        ],
      }),
      parseSystem2Inference({
        promotions: [{ thought_id: "t1" }],
        end_of_chain: { thought_ids: ["t1"], text: "answer" },
      }),
    );

    const jpeg = Buffer.from("ffd8ffe000104a464946", "hex").toString("base64");
    const uploads = mapIleSoloEventsToUploadInputs(events, CONTEXT, {
      stills: [
        {
          timestampMs: 6500,
          mimeType: "image/jpeg",
          fileName: "ile-screen-6500.jpg",
          dataBase64: jpeg,
        },
      ],
    });

    const names = uploads.map((row) => row.tool_name);
    const types = uploads.map((row) => row.type);
    expect(names).toContain(ILE_TRACE_TOOL_NAME);
    expect(names).toContain(ILE_SPEECH_TOOL_NAME);
    expect(names).toContain(ILE_IDLE_TOOL_NAME);
    expect(names).not.toContain(ILE_CHAT_TOOL_NAME);
    expect(names).not.toContain(TAP_TRACE_TOOL_NAME);
    expect(names).not.toContain(TAP_SPEECH_TOOL_NAME);
    expect(names).not.toContain(TAP_CHAT_TOOL_NAME);
    expect(names).not.toContain(TAP_IDLE_TOOL_NAME);
    expect(types).toContain("tool");
    expect(types).toContain("screen");
    expect(types).not.toContain("speech");
    expect(types).not.toContain("eeg");

    const thoughtRow = uploads.find((row) => row.tool_name === ILE_TRACE_TOOL_NAME);
    expect(thoughtRow?.type).toBe("tool");
    expect(thoughtRow?.mime_type).toBe("application/json");
    const thoughtPayload = decodePayload(thoughtRow!.data);
    expect(thoughtPayload.type).toBe("uncertain_systems_ile_thought_trace");
    expect(thoughtRow?.timestamp_ms).toBeGreaterThanOrEqual(0);

    const speechRow = uploads.find((row) => row.tool_name === ILE_SPEECH_TOOL_NAME);
    const speechPayload = decodePayload(speechRow!.data);
    expect(speechPayload.type).toBe("uncertain_systems_ile_speech_segment");

    const idleRow = uploads.find((row) => row.tool_name === ILE_IDLE_TOOL_NAME);
    const idlePayload = decodePayload(idleRow!.data);
    expect(idlePayload.type).toBe("uncertain_systems_ile_idle_heartbeat");

    const screenRow = uploads.find((row) => row.type === "screen");
    expect(screenRow?.mime_type).toBe("image/jpeg");
    expect(screenRow?.timestamp_ms).toBe(6500);

    const mapper = readFileSync(PERSIST_MAP, "utf8");
    expect(mapper).not.toMatch(/lwm[_-]?snapshot/i);
    expect(mapper).not.toMatch(/snapshot-all-progress/);
    expect(mapper).not.toMatch(/type:\s*["']speech["']/);
    expect(mapper).toContain("uploadWorkspaceProofOfWork");
    expect(readFileSync(join(ROOT, "utilities/import-think-aloud-pow/types.ts"), "utf8")).toContain(
      "UploadWorkspaceProofOfWorkInput",
    );
    expect(mapper).toContain("buildIleThoughtTracePayload");
    expect(mapper).toContain("buildIleSpeechSegmentPayload");
    expect(mapper).toContain("buildIleIdleHeartbeatPayload");
  });
});

describe("import-think-aloud-pow CLI", () => {
  it("documents flags and dry-runs ILE Solo events from the transcript fixture", () => {
    mkdirSync(SCRATCH, { recursive: true });
    const bin = join(ROOT, "node_modules/.bin/vite-node");
    const script = join(ROOT, "utilities/import-think-aloud-pow/main.ts");
    const envNoKey = { ...process.env, XAI_API_KEY: "" };

    const help = spawnSync(bin, ["--config", "vitest.config.ts", script, "--help"], {
      cwd: ROOT,
      encoding: "utf8",
      env: envNoKey,
    });
    const dry = spawnSync(
      bin,
      [
        "--config",
        "vitest.config.ts",
        script,
        "--dry-run",
        "--transcript",
        TRANSCRIPT_FIXTURE,
        "--workspace",
        CONTEXT.workspaceId,
      ],
      { cwd: ROOT, encoding: "utf8", env: envNoKey },
    );
    const media = spawnSync(
      bin,
      [
        "--config",
        "vitest.config.ts",
        script,
        "--dry-run",
        "--media",
        WAV_FIXTURE,
        "--workspace",
        CONTEXT.workspaceId,
      ],
      { cwd: ROOT, encoding: "utf8", env: envNoKey },
    );

    const log = [
      "=== --help ===",
      `status=${help.status}`,
      help.stdout,
      help.stderr,
      "=== --dry-run --transcript ===",
      `status=${dry.status}`,
      dry.stdout,
      dry.stderr,
      "=== --dry-run --media (no XAI_API_KEY) ===",
      `status=${media.status}`,
      media.stdout,
      media.stderr,
      `ffmpeg probe: ${spawnSync("ffmpeg", ["-version"], { encoding: "utf8" }).status === 0 ? "present" : "absent"}`,
    ].join("\n");
    writeFileSync(join(SCRATCH, "import-think-aloud-cli.log"), log);

    expect(help.status).toBe(0);
    expect(help.stdout).toContain("--media");
    expect(help.stdout).toContain("--workspace");
    expect(help.stdout).toContain("--dry-run");
    expect(help.stdout).toMatch(/Explore Solo/i);

    expect(dry.status).toBe(0);
    const parsed = JSON.parse(dry.stdout) as {
      tool_names: string[];
      events: Array<{ kind: string }>;
      session_mode: string;
    };
    expect(parsed.session_mode).toBe("project");
    expect(parsed.tool_names).toContain(ILE_TRACE_TOOL_NAME);
    expect(parsed.tool_names).toContain(ILE_SPEECH_TOOL_NAME);
    expect(parsed.events.some((event) => event.kind === "thought")).toBe(true);
    expect(parsed.events.some((event) => event.kind === "speech_start")).toBe(true);

    expect(existsSync(WAV_FIXTURE)).toBe(true);
    expect(media.status).not.toBe(0);
    expect(`${media.stdout}\n${media.stderr}`).toMatch(/XAI_API_KEY/);
  });
});
