/** Shared prompt text extractors for inventory generation. */

export function extractDefaultPrompt(src, key) {
  const re = new RegExp(`\\n  ${key}: \`([\\s\\S]*?)\`,`);
  const m = src.match(re);
  return m ? m[1] : null;
}

export function extractConstTemplate(src, name) {
  const re = new RegExp(
    `(?:export )?const ${name} = \`([\\s\\S]*?)\`(?:\\.trim\\(\\))?;`,
  );
  const m = src.match(re);
  return m ? m[1] : null;
}

export function extractVarTemplate(src, varName) {
  const re = new RegExp(`const ${varName} = \`([\\s\\S]*?)\`;`);
  const m = src.match(re);
  return m ? m[1] : null;
}

export function extractFunctionReturnTemplate(src, fnName) {
  const fnRe = new RegExp(
    `(?:export )?(?:async )?function ${fnName}\\([^)]*\\)[^{]*\\{`,
  );
  const fnMatch = fnRe.exec(src);
  if (!fnMatch) return null;
  const body = src.slice(fnMatch.index + fnMatch[0].length);
  const retIdx = body.indexOf("return `");
  if (retIdx < 0) return null;
  let i = retIdx + "return `".length;
  let out = "";
  while (i < body.length) {
    const ch = body[i];
    if (ch === "\\" && body[i + 1] === "`") {
      out += "`";
      i += 2;
      continue;
    }
    if (ch === "`") {
      const tail = body.slice(i);
      if (/^`(?:\.trim\(\))?;\s*(?:\n|\/\/|\/\*|\})/.test(tail)) break;
    }
    out += ch;
    i++;
  }
  return out;
}

export function extractSystemMessageBacktick(src) {
  const matches = [...src.matchAll(/systemMessage\(\s*\n?\s*`([\s\S]*?)`\s*,?\s*\)/g)];
  return matches.map((m) => m[1]);
}

export function extractSystemMessageQuoted(src) {
  const matches = [
    ...src.matchAll(/systemMessage\(\s*\n?\s*'((?:\\'|[^'])*)'\s*,?\s*\)/g),
    ...src.matchAll(/systemMessage\(\s*"((?:\\"|[^"])*)"\s*,?\s*\)/g),
  ];
  return matches.map((m) => m[1]);
}

export function extractUserMessageTemplates(src) {
  return [...src.matchAll(/userMessage\(\s*`([\s\S]*?)`\s*\)/g)].map((m) => m[1]);
}

export function extractTapOpeningQuestionExtras(src) {
  const fnSlice = src.slice(src.indexOf("export async function generateTapOpeningQuestion"));
  if (fnSlice.length < 50) return [];
  const ext = fnSlice.match(
    /systemMessage\(\s*\n?\s*`\$\{context\}\\n\\n([\s\S]*?)`,\s*\)/,
  );
  const user = fnSlice.match(/userMessage\(`([\s\S]*?)`\)/);
  const entries = [];
  if (ext?.[1]) {
    entries.push({
      symbol: "generateTapOpeningQuestion-system-extension",
      text: `[Appended after full buildTapScoreInstructions(context) output]\n\n${ext[1]}`,
    });
  }
  if (user?.[1]) {
    entries.push({
      symbol: "generateTapOpeningQuestion-userMessage",
      text: user[1],
    });
  }
  return entries;
}

const NAMED_CONST_HINT =
  /^(prompt|aiPrompt|promptBody|scoringPrompt|systemPrompt|translationPrompt|BASE_SYSTEM_PROMPT|SYSTEM_PROMPT|ILE_CONTEXT|PERFORMANCE_REMEDIATION_GUARDRAILS|ORBIT_PERFORMANCE_STYLE_PROMPT)$/i;

const BUILDER_FUNCTIONS = [
  "buildTapScoreInstructions",
  "buildPerformanceReportInstructions",
  "buildPerformanceChatInstructions",
  "buildProofOfWorkSchemaInstructions",
  "buildProofOfWorkSchemaPrompt",
  "buildIntegrationSkillInstructions",
  "buildIntegrationSkillPrompt",
  "buildTraceScoringInstructions",
];

export function extractAllEntries(src, relPath) {
  const entries = [];
  const seen = new Set();

  function add(symbol, text) {
    const t = (text || "").trim();
    if (!t || t.length < 10) return;
    const key = `${symbol}::${t.slice(0, 40)}`;
    if (seen.has(key)) return;
    seen.add(key);
    entries.push({ symbol, text: t });
  }

  if (relPath === "lib/prompts.ts") {
    return entries;
  }

  if (relPath === "lib/tap-score.ts") {
    const ghc = extractFunctionReturnTemplate(src, "buildTapScoreInstructions");
    if (ghc) add("buildTapScoreInstructions", ghc);
    for (const extra of extractTapOpeningQuestionExtras(src)) {
      add(extra.symbol, extra.text);
    }
    const tapOverlay =
      "You are now responding in a selective thought interface, not a live voice call. The learner submits transcribed thought fragments. Reply in a Socratic style with one concise question, or at most one brief reflection followed by a question. Elicit evidence about what they learned, what they can transfer, and what gaps remain. Prioritize definitions, causal reasoning, examples, application, and repair. Do not score yet. Do not explain the answer for them unless they explicitly ask for help.";
    add("TAP-chat-overlay", tapOverlay);
    return entries;
  }

  if (relPath === "lib/local-inference.ts") {
    add(
      "transcribe-userMessage",
      "Transcribe the audio exactly as spoken. Only output the transcription, no commentary.",
    );
    const sys = src.match(/const systemPrompt = `([\s\S]*?)`;/);
    if (sys) add("generateProbe-systemPrompt", sys[1]);
    const user = extractVarTemplate(src, "userPrompt");
    if (user) add("generateProbe-userPrompt", user);
    return entries;
  }

  for (const fn of BUILDER_FUNCTIONS) {
    const t = extractFunctionReturnTemplate(src, fn);
    if (t) add(fn, t);
  }

  if (relPath === "app/api/session/performance-chat/route.ts") {
    const t = extractFunctionReturnTemplate(src, "buildSystemInstructions");
    if (t) add("buildSystemInstructions", t);
  }

  for (const m of src.matchAll(/(?:export )?const (\w+) = `([\s\S]*?)`(?:\.trim\(\))?;/g)) {
    if (NAMED_CONST_HINT.test(m[1])) add(m[1], m[2]);
  }

  extractSystemMessageBacktick(src).forEach((t, i) => add(`systemMessage#${i + 1}`, t));
  extractSystemMessageQuoted(src).forEach((t, i) => add(`systemMessage-quoted#${i + 1}`, t));
  extractUserMessageTemplates(src).forEach((t, i) => add(`userMessage#${i + 1}`, t));

  if (relPath === "app/api/prep-material/route.ts") {
    const switchBlock = src.slice(src.indexOf("switch (type)"), src.indexOf("default:") + 120);
    if (switchBlock.length > 50) add("prep-material-switch-prompts", switchBlock);
  }

  if (relPath === "lib/pow-api/create-verification-workspace.ts") {
    const users = extractUserMessageTemplates(src);
    users.forEach((t, i) =>
      add(`createVerificationWorkspaceFromPrompt-userMessage#${i + 1}`, t),
    );
  }

  return entries;
}