import { ILE_THOUGHT_CHAIN_GAP_MS } from "@/lib/ile-context-auto-stash";
import { ILE_IDLE_POW_INTERVAL_MS } from "@/lib/ile-thought-traces";
import { TAP_SPEECH_SEGMENT_GAP_MS } from "@/lib/tap-speech-proof-of-work";
import { TAP_SILENCE_AUTO_STASH_MS } from "@/lib/tap-session-purity";
import { ILE_SESSION_MODE_LABELS } from "@/lib/ile-mode";

/** Speech start/stop gap — same 2600ms the live ILE/TAP mic uses. */
export const ILE_IMPORT_SPEECH_GAP_MS = TAP_SPEECH_SEGMENT_GAP_MS;

/** Thought chain window — live ILE Explore Solo. */
export const ILE_IMPORT_CHAIN_GAP_MS = ILE_THOUGHT_CHAIN_GAP_MS;

/** Silence with forming text → `auto_stash` (live ILE uses TAP silence timing). */
export const ILE_IMPORT_AUTO_STASH_MS = TAP_SILENCE_AUTO_STASH_MS;

/** Idle heartbeat cadence. */
export const ILE_IMPORT_IDLE_MS = ILE_IDLE_POW_INTERVAL_MS;

export const ILE_IMPORT_SESSION_MODE = "project" as const;
export const ILE_IMPORT_SESSION_MODE_LABEL = ILE_SESSION_MODE_LABELS.project;
export const ILE_IMPORT_CAPTURE_CHANNEL = "offline_media_import";
