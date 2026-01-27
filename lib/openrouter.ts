import type { 
  OpenRouterMessage, 
  OpenRouterResponse,
  Challenge,
  GeneratePlanRequest
} from "./types";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const DEFAULT_MODEL = "google/gemini-3-pro-preview";

interface OpenRouterConfig {
  model?: string;
  temperature?: number;
  max_tokens?: number;
}

/**
 * Call OpenRouter API with messages
 */
export async function callOpenRouter(
  messages: OpenRouterMessage[],
  config: OpenRouterConfig = {}
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY is not set");
  }

  const response = await fetch(OPENROUTER_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${apiKey}`,
      "HTTP-Referer": process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
      "X-Title": "OpenLesson",
    },
    body: JSON.stringify({
      model: config.model || DEFAULT_MODEL,
      messages,
      temperature: config.temperature ?? 0.7,
      max_tokens: config.max_tokens ?? 4096,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`OpenRouter API error: ${error}`);
  }

  const data: OpenRouterResponse = await response.json();
  return data.choices[0]?.message?.content || "";
}

/**
 * Generate a learning plan with challenges
 */
export async function generatePlanContent(
  request: GeneratePlanRequest
): Promise<{
  description: string;
  challenges: Array<{
    title: string;
    description: string;
    success_criteria: string;
    hints: string[];
  }>;
}> {
  const { topic, context, difficulty = "beginner", num_challenges = 5 } = request;

  const systemPrompt = `You are an expert educational content creator. Your task is to create engaging, structured learning plans with practical challenges.

Your response MUST be valid JSON with this exact structure:
{
  "description": "A 2-3 sentence description of what the learner will accomplish",
  "challenges": [
    {
      "title": "Short challenge title",
      "description": "Detailed description of what the learner needs to do",
      "success_criteria": "Clear criteria for what constitutes a successful answer",
      "hints": ["Hint 1", "Hint 2"]
    }
  ]
}

Guidelines:
- Create exactly ${num_challenges} challenges
- Challenges should be progressive, building on previous knowledge
- Each challenge should be practical and require a written response
- Success criteria should be specific and measurable
- Include 2-3 hints per challenge
- Tailor difficulty to the ${difficulty} level
- Make challenges engaging and focused on real understanding, not memorization`;

  const userPrompt = `Create a learning plan for: "${topic}"
${context ? `\nAdditional context from learner: ${context}` : ""}

Difficulty level: ${difficulty}
Number of challenges: ${num_challenges}

Return ONLY valid JSON, no markdown or additional text.`;

  const content = await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], {
    temperature: 0.7,
  });

  // Parse JSON response
  try {
    // Try to extract JSON from the response (in case there's any extra text)
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate structure
    if (!parsed.description || !Array.isArray(parsed.challenges)) {
      throw new Error("Invalid response structure");
    }

    return parsed;
  } catch (error) {
    console.error("Failed to parse plan response:", content);
    throw new Error("Failed to generate plan - invalid AI response");
  }
}

/**
 * Evaluate a submission against a challenge
 */
export async function evaluateSubmission(
  challenge: Challenge,
  submissionContent: string
): Promise<{
  passed: boolean;
  feedback: string;
  score: number;
}> {
  const systemPrompt = `You are an expert educational evaluator. Your task is to evaluate a learner's submission against specific success criteria.

Your response MUST be valid JSON with this exact structure:
{
  "passed": true/false,
  "feedback": "Detailed constructive feedback explaining what was good and what could be improved",
  "score": 0-100
}

Evaluation guidelines:
- Be encouraging but honest
- A score of 70+ with all key criteria met = passed
- Provide specific, actionable feedback
- Reference the success criteria in your evaluation
- If the answer is mostly correct but incomplete, still provide a reasonable score
- Maximum feedback length: 3-4 sentences`;

  const userPrompt = `Challenge: ${challenge.title}

Description: ${challenge.description}

Success Criteria: ${challenge.success_criteria}

Learner's Submission:
"""
${submissionContent}
"""

Evaluate this submission and return ONLY valid JSON.`;

  const content = await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], {
    temperature: 0.3, // Lower temperature for more consistent evaluation
  });

  // Parse JSON response
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    // Validate and normalize
    return {
      passed: Boolean(parsed.passed),
      feedback: String(parsed.feedback || "No feedback provided"),
      score: Math.min(100, Math.max(0, Number(parsed.score) || 0)),
    };
  } catch (error) {
    console.error("Failed to parse evaluation response:", content);
    throw new Error("Failed to evaluate submission - invalid AI response");
  }
}

/**
 * Generate adapted challenges based on learner progress
 */
export async function generateAdaptedChallenges(
  topic: string,
  completedChallenges: Challenge[],
  averageScore: number,
  numNewChallenges: number = 3
): Promise<Array<{
  title: string;
  description: string;
  success_criteria: string;
  hints: string[];
}>> {
  const systemPrompt = `You are an expert educational content creator. Your task is to create new challenges that adapt to the learner's demonstrated level.

Your response MUST be valid JSON with this exact structure:
{
  "challenges": [
    {
      "title": "Short challenge title",
      "description": "Detailed description of what the learner needs to do",
      "success_criteria": "Clear criteria for what constitutes a successful answer",
      "hints": ["Hint 1", "Hint 2"]
    }
  ]
}

Guidelines:
- Create exactly ${numNewChallenges} new challenges
- If average score is high (>85), make challenges more difficult
- If average score is low (<60), provide more scaffolding and simpler challenges
- Build on concepts from completed challenges
- Each challenge should be practical and require a written response`;

  const completedSummary = completedChallenges.map(c => 
    `- ${c.title}: ${c.status}`
  ).join("\n");

  const userPrompt = `Topic: "${topic}"

Completed challenges:
${completedSummary}

Learner's average score: ${averageScore}%

Create ${numNewChallenges} new adapted challenges. Return ONLY valid JSON.`;

  const content = await callOpenRouter([
    { role: "system", content: systemPrompt },
    { role: "user", content: userPrompt },
  ], {
    temperature: 0.7,
  });

  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error("No JSON found in response");
    }
    
    const parsed = JSON.parse(jsonMatch[0]);
    
    if (!Array.isArray(parsed.challenges)) {
      throw new Error("Invalid response structure");
    }

    return parsed.challenges;
  } catch (error) {
    console.error("Failed to parse adapted challenges response:", content);
    throw new Error("Failed to generate adapted challenges");
  }
}
