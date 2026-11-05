/**
 * Detects public docs that still instruct the retired headless PoW loop.
 * Mentions in a "do not call / not public / removed" window are allowed.
 */

const LOOP =
  /start_session[\s\S]{0,200}upload_proof_of_work[\s\S]{0,200}end_session/gi;

const RETIRED =
  /do not call|is \*\*not\*\*|are not public|not a public agent|removed from the public|those tools are not|public_pow_retired|\b410\b/i;

export function publicDocInstructsHeadlessPowLoop(text: string): boolean {
  let match: RegExpExecArray | null;
  const loop = new RegExp(LOOP.source, LOOP.flags);
  while ((match = loop.exec(text))) {
    const start = Math.max(0, match.index - 120);
    const window = text.slice(start, match.index + match[0].length + 100);
    if (!RETIRED.test(window)) return true;
  }
  if (/(?:^|\n)\s*(?:\d+\.|[-*])\s*`?start_session`?/m.test(text)) return true;
  if (/MCP twins:[^\n]*start_session/i.test(text)) return true;
  if (/Headless session \(`start_session`/i.test(text)) return true;
  if (/call `start_session`/i.test(text) && !/do not call `start_session`/i.test(text)) {
    return true;
  }
  return false;
}
