/**
 * Agent-facing PoW model contract shared by the integration skill and MCP
 * upload / stash-buffer tools. Instructions only — not an encoder.
 */

import { ILE_SPEECH_TOOL_NAME, ILE_TRACE_TOOL_NAME } from "@/lib/ile-thought-traces";
import {
  ILE_WORK_CANVAS_COMMAND_POW_IDS,
  ILE_WORK_CANVAS_POW_TOOL_NAME,
  ILE_WORK_CANVAS_USE_AND_PROMPT_ACTIONS,
} from "@/lib/ile-work-canvas-pow";
import { TAP_SPEECH_TOOL_NAME } from "@/lib/tap-speech-proof-of-work";
import { TAP_TRACE_TOOL_NAME } from "@/lib/tap-score-traces";
import { POW_MODEL_VERSION } from "./workspace-proof-of-work";

const CANVAS_PROMPT_ACTIONS = ["board_prompt", "expand_more"] as const;

const CANVAS_USE_ACTIONS = ILE_WORK_CANVAS_USE_AND_PROMPT_ACTIONS.filter(
  (action) => action !== "board_prompt" && action !== "expand_more",
);

/** What agents must follow when they simulate proof of work for synthetic regions. */
export function powModelAgentSimulationContract(): string {
  return [
    `Simulate proof of work as ${POW_MODEL_VERSION} only.`,
    `Submit that simulated work as stored type tool and stamp every row with pow_model_version ${POW_MODEL_VERSION}.`,
    "Do not invent a new stored type.",
    "Do not collapse canvas use, canvas prompts, canvas commands, voice thoughts, and speech into one generic event.",
    `Keep those encodings distinct.`,
    `Canvas use is tool_name ${ILE_WORK_CANVAS_POW_TOOL_NAME} with tool_action ${CANVAS_USE_ACTIONS.join(", ")}.`,
    `Canvas prompts are tool_action ${CANVAS_PROMPT_ACTIONS.join(" and ")}, not a canvas command.`,
    `Canvas commands are their own tool_action ids (${ILE_WORK_CANVAS_COMMAND_POW_IDS.join(", ")}) plus metadata.command_id, and are not expand_more.`,
    `Voice thoughts stay tool_name ${ILE_TRACE_TOOL_NAME} or ${TAP_TRACE_TOOL_NAME}, not canvas.`,
    `Speech stays tool_name ${ILE_SPEECH_TOOL_NAME} or ${TAP_SPEECH_TOOL_NAME} as a tool row, not a stored type named speech, and not canvas.`,
    "That simulated stream is the proof of work formerly called TAPBench PoW, produced so it can form synthetic knowledge regions.",
  ].join(" ");
}

/** MCP pow_model_version field. Required on simulated uploads, not a silent optional. */
export function powModelVersionFieldDescription(): string {
  return `Required when simulating work. Must be ${POW_MODEL_VERSION}. ${powModelAgentSimulationContract()}`;
}

/** Heading of the catalog appended to every downloaded skill.md. */
export const CANVAS_TAP_SIMULATION_HEADING = "## Simulate TAP on the canvas";

/**
 * Compact catalog the agent that reads skill.md uses to simulate a human TAP
 * session. tool_name and tool_action are the stored values, not labels.
 */
export function canvasTapSimulationSkillSection(): string {
  const canvasUse = CANVAS_USE_ACTIONS.join(", ");
  const commands = ILE_WORK_CANVAS_COMMAND_POW_IDS.join(", ");
  return [
    CANVAS_TAP_SIMULATION_HEADING,
    "",
    `Simulate a human TAP session as ${POW_MODEL_VERSION}. Stored type is tool. Stamp pow_model_version ${POW_MODEL_VERSION}. Use only these tool_name and tool_action values. Pan, zoom, and scroll are not events.`,
    "",
    "| Human action | tool_name | tool_action |",
    "| --- | --- | --- |",
    `| Thinks aloud | ${TAP_TRACE_TOOL_NAME} | system1:pause_finalize or system2:send. Payload type uncertain_systems_tap_thought_trace. metadata.text is the thought. |`,
    `| Speaks | ${TAP_SPEECH_TOOL_NAME} | speech_start or speech_stop. Payload type uncertain_systems_tap_speech_segment. |`,
    `| Draws or edits the canvas | ${ILE_WORK_CANVAS_POW_TOOL_NAME} | ${canvasUse} |`,
    `| Types a prompt in the board bar | ${ILE_WORK_CANVAS_POW_TOOL_NAME} | board_prompt. metadata.prompt is the full prompt. |`,
    `| Asks about the selection | ${ILE_WORK_CANVAS_POW_TOOL_NAME} | expand_more. metadata.prompt is the full prompt. |`,
    `| Presses a canvas command | ${ILE_WORK_CANVAS_POW_TOOL_NAME} | ${commands}. Same id in metadata.command_id. Not expand_more. |`,
    "",
    "Send one row per action. A command is not a prompt. Speech is not a stored type named speech.",
    "",
  ].join("\n");
}

/** Append the catalog once to the skill.md an agent downloads. */
export function withCanvasTapSimulationSkill(skillMd: string): string {
  const body = String(skillMd || "").trimEnd();
  if (body.includes(CANVAS_TAP_SIMULATION_HEADING)) {
    return body.endsWith("\n") ? body : `${body}\n`;
  }
  const section = canvasTapSimulationSkillSection();
  return body ? `${body}\n\n${section}` : section;
}
