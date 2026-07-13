// ============================================
// AI PROBE GENERATOR - Generates targeted questions via Grok 4.3
// ============================================

import { callXai, DEFAULT_MODEL, type Message } from "./xai-client";

export interface Probe {
  id: number;
  text: string;
  type: "conceptual" | "application" | "analysis";
}

const SYSTEM_PROMPT = `You are an expert Socratic tutor specializing in probing students' understanding of any topic. Your task is to generate exactly 3 targeted questions that test deep comprehension, not surface recall.

Guidelines:
- Questions should probe conceptual understanding, not just facts
- Mix of difficulty: 1 easy, 1 medium, 1 challenging
- Format: Each question should make the student THINK, not just remember
- No multiple choice - open-ended questions only
- Questions should be self-contained and clear
- Avoid jargon unless it's essential to the topic
- Make questions applicable to real-world scenarios when possible

Response format (JSON array):
[
  {"id": 1, "text": "...", "type": "conceptual"},
  {"id": 2, "text": "...", "type": "application"},
  {"id": 3, "text": "...", "type": "analysis"}
]

Types:
- conceptual: Tests understanding of core concepts and definitions
- application: Tests ability to apply concepts to new situations
- analysis: Tests ability to analyze, compare, or synthesize`;

export async function generateProbes(topic: string): Promise<Probe[]> {
  const messages: Message[] = [
    { role: "system", content: SYSTEM_PROMPT },
    { role: "user", content: `Generate 3 targeted probes to assess mastery of: "${topic}". Make them thought-provoking and suitable for mental exploration while wearing an EEG headband.` },
  ];

  try {
    const response = await callXai<Probe[]>(messages, {
      model: DEFAULT_MODEL,
      maxTokens: 800,
      temperature: 0.7,
      responseFormat: "json",
    });

    if (response.success && response.data) {
      return response.data;
    }

    console.warn("Probe generation failed, using fallback:", response.error);
    return generateFallbackProbes(topic);
  } catch (err) {
    console.error("Error generating probes:", err);
    return generateFallbackProbes(topic);
  }
}

function generateFallbackProbes(topic: string): Probe[] {
  return [
    {
      id: 1,
      text: `What are the fundamental principles of ${topic}?`,
      type: "conceptual",
    },
    {
      id: 2,
      text: `How would you apply the core concepts of ${topic} to solve a real-world problem?`,
      type: "application",
    },
    {
      id: 3,
      text: `What are the strengths and limitations of ${topic} compared to alternative approaches?`,
      type: "analysis",
    },
  ];
}

export function validateProbes(probes: unknown): probes is Probe[] {
  if (!Array.isArray(probes)) return false;
  return probes.every(
    (p) => typeof p === "object" && "id" in p && "text" in p && "type" in p
  );
}
