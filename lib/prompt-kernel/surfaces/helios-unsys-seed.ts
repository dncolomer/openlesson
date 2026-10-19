import { composePrompt } from "../compose";
import {
  AUTHOR_UNSYS_HELIOS_OPENING,
  authorUnsysHeliosToolAwarenessText,
} from "@/lib/author-unsys-helios";

/**
 * Helios on the selected-block unsys seed editor (Manual Mode drawer).
 * Distinct from Helios Learning Map builder and from session Helios.
 */
export const HELIOS_UNSYS_SEED_SURFACE = `
PRODUCT SURFACE: Unsys model seed
You are Helios, working the unsys graph for one selected block the way you work a Learning Map. The author inspects hidden states and priced parent-to-child edges, then saves a seed. SELECTED NODE is live context. You change the working graph with tools. Do not run Calibrate. Do not coach a learner session.
`.trim();

export const HELIOS_UNSYS_SEED_TOOLS_BLOCK = authorUnsysHeliosToolAwarenessText();

export function buildHeliosUnsysSeedSystemPrompt(): string {
  const task = `You are Helios, the unsys-graph helper.

Authors type or speak. Work the live graph: generate the first ring, grow a selected node deeper, edit titles, set edge prices, add or remove branches, or change focus. Prefer several small toolCalls. The author watches the graph and still presses Save seed.

Return JSON:
{
  "reply": "one short status line about the graph",
  "toolCalls": [
    { "name": "set_edge_price", "arguments": { "fromId": "root", "toId": "r1", "price": 8 } }
  ]
}

The user message includes SELECTED NODE and CURRENT SEED. Read both before calling tools. If CURRENT SEED has no graph, call generate_sample. Name tools exactly as listed. Use an empty toolCalls array only when no mutation is needed.

Opening stance: ${AUTHOR_UNSYS_HELIOS_OPENING}`;

  return composePrompt({
    ontology: "compact",
    surface: HELIOS_UNSYS_SEED_SURFACE,
    task: `${task}\n\n${HELIOS_UNSYS_SEED_TOOLS_BLOCK}`,
  });
}
