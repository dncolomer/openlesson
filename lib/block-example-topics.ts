/**
 * Pure derivation of example questions + topics a block explores.
 * Used by the block-detail "Examples" mini-tab (no LLM required).
 */

export type BlockExampleTopicsInput = {
  title?: string | null;
  description?: string | null;
  planningPrompt?: string | null;
  localNotes?: string | null;
};

export type BlockExampleTopicsResult = {
  topics: string[];
  questions: string[];
};

function cleanLine(raw: string): string {
  return raw.replace(/^[\s•\-*–—\d.)]+/, "").replace(/\s+/g, " ").trim();
}

function splitSentences(text: string): string[] {
  return text
    .split(/(?<=[.!?])\s+|\n+/)
    .map(cleanLine)
    .filter((s) => s.length >= 12);
}

/**
 * Extract topic phrases and sample practice questions from block text fields.
 */
export function deriveBlockExampleTopics(
  input: BlockExampleTopicsInput,
): BlockExampleTopicsResult {
  const title = cleanLine(String(input.title || ""));
  const description = cleanLine(String(input.description || ""));
  const planning = cleanLine(String(input.planningPrompt || ""));
  const notes = cleanLine(String(input.localNotes || ""));

  const topics = new Set<string>();
  if (title) topics.add(title);

  for (const chunk of [description, planning, notes]) {
    if (!chunk) continue;
    // Prefer short noun-ish phrases: comma / semicolon / "and" lists, else first clause.
    const parts = chunk
      .split(/[;•|]|(?:\s+and\s+)|(?:\s+—\s+)/i)
      .map(cleanLine)
      .filter((p) => p.length >= 4 && p.length <= 80);
    for (const p of parts.slice(0, 4)) {
      topics.add(p.replace(/[.!?]+$/, ""));
    }
  }

  const questions: string[] = [];
  const seedTexts = [description, planning, notes].filter(Boolean);
  for (const text of seedTexts) {
    for (const s of splitSentences(text)) {
      if (/\?$/.test(s)) {
        questions.push(s);
      }
    }
  }

  // Synthesize practice questions when the block has no explicit ones.
  if (questions.length === 0 && title) {
    questions.push(`What is the core idea of “${title}”?`);
    questions.push(`How would you explain “${title}” to a peer?`);
    if (description) {
      questions.push(`What evidence or steps support: ${description.slice(0, 120)}${description.length > 120 ? "…" : ""}?`);
    } else {
      questions.push(`Where does “${title}” show up in a real problem or project?`);
    }
  }

  const topicList = [...topics].slice(0, 8);
  if (topicList.length === 0 && title) topicList.push(title);

  return {
    topics: topicList,
    questions: [...new Set(questions)].slice(0, 6),
  };
}
