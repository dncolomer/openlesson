/**
 * Pure derivation of content samples (topics + practice questions) for a block.
 * Used by the block-detail "Content Samples" drawer as a local fallback; LLM
 * regenerate uses the same result shape.
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

/** Normalize LLM/API payload into a safe topics + questions result. */
export function normalizeContentSamplesPayload(raw: unknown): BlockExampleTopicsResult {
  if (!raw || typeof raw !== "object") {
    return { topics: [], questions: [] };
  }
  const rec = raw as Record<string, unknown>;
  const topicsRaw = Array.isArray(rec.topics) ? rec.topics : [];
  const questionsRaw = Array.isArray(rec.questions)
    ? rec.questions
    : Array.isArray(rec.example_questions)
      ? rec.example_questions
      : [];
  const topics = topicsRaw
    .map((t) => cleanLine(String(t || "")))
    .filter((t) => t.length >= 2)
    .slice(0, 8);
  const questions = questionsRaw
    .map((q) => cleanLine(String(q || "")))
    .filter((q) => q.length >= 8)
    .slice(0, 8);
  return {
    topics: [...new Set(topics)],
    questions: [...new Set(questions)],
  };
}

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
