// Database types

export type PlanStatus = "active" | "completed" | "archived";
export type ChallengeStatus = "pending" | "in_progress" | "passed" | "failed";
export type SubmissionStatus = "pending" | "evaluating" | "passed" | "failed";

export interface Profile {
  id: string;
  full_name: string | null;
  created_at: string;
}

export interface Plan {
  id: string;
  user_id: string;
  topic: string;
  description: string;
  prompt_used: string;
  metadata: PlanMetadata | null;
  status: PlanStatus;
  created_at: string;
  updated_at: string;
}

export interface PlanMetadata {
  difficulty?: "beginner" | "intermediate" | "advanced";
  estimated_hours?: number;
  tags?: string[];
  model_used?: string;
}

export interface Challenge {
  id: string;
  plan_id: string;
  order_index: number;
  title: string;
  description: string;
  success_criteria: string;
  hints?: string[];
  status: ChallengeStatus;
  created_at: string;
  updated_at: string;
}

export interface Submission {
  id: string;
  challenge_id: string;
  user_id: string;
  content: string;
  status: SubmissionStatus;
  feedback: string | null;
  score: number | null;
  created_at: string;
}

// Extended types with relations
export interface PlanWithChallenges extends Plan {
  challenges: Challenge[];
}

export interface ChallengeWithSubmissions extends Challenge {
  submissions: Submission[];
}

// API types
export interface GeneratePlanRequest {
  topic: string;
  context?: string;
  difficulty?: "beginner" | "intermediate" | "advanced";
  num_challenges?: number;
}

export interface GeneratePlanResponse {
  plan: Plan;
  challenges: Challenge[];
}

export interface EvaluateSubmissionRequest {
  challenge_id: string;
  content: string;
}

export interface EvaluateSubmissionResponse {
  submission: Submission;
  passed: boolean;
  feedback: string;
  score: number;
}

export interface RecomputePlanRequest {
  plan_id: string;
}

export interface RecomputePlanResponse {
  updated_challenges: Challenge[];
}

// OpenRouter types
export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface OpenRouterChoice {
  message: {
    content: string;
  };
}

export interface OpenRouterResponse {
  choices: OpenRouterChoice[];
}
