"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Card, Button, Input, Textarea } from "@/components/ui";
import { 
  Sparkles, 
  Loader2, 
  BookText,
  ArrowLeft,
  ChevronDown
} from "lucide-react";
import Link from "next/link";

type Difficulty = "beginner" | "intermediate" | "advanced";

export default function NewPlanPage() {
  const router = useRouter();
  const [topic, setTopic] = useState("");
  const [context, setContext] = useState("");
  const [difficulty, setDifficulty] = useState<Difficulty>("beginner");
  const [numChallenges, setNumChallenges] = useState(5);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/plans/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          topic,
          context: context || undefined,
          difficulty,
          num_challenges: numChallenges,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to generate plan");
      }

      // Redirect to the new plan
      router.push(`/learn/${data.plan.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Back link */}
      <Link
        href="/dashboard/plans"
        className="inline-flex items-center gap-2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Plans
      </Link>

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Create New Plan</h1>
        <p className="text-[var(--color-stone)]">
          Tell us what you want to learn and we&apos;ll generate a personalized lesson plan
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <Card padding="lg">
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
                {error}
              </div>
            )}

            {/* Topic */}
            <Input
              label="What do you want to learn?"
              placeholder="e.g., Machine Learning Fundamentals, Spanish for Beginners, React Hooks"
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              required
              helperText="Be as specific as you like. The more detail, the better the plan."
            />

            {/* Context (optional) */}
            <Textarea
              label="Additional context (optional)"
              placeholder="e.g., I already know Python basics, I want to focus on practical applications..."
              value={context}
              onChange={(e) => setContext(e.target.value)}
              helperText="Share your background or specific goals to personalize the plan."
            />

            {/* Difficulty */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                Difficulty Level
              </label>
              <div className="relative">
                <select
                  value={difficulty}
                  onChange={(e) => setDifficulty(e.target.value as Difficulty)}
                  className="w-full px-4 py-3 bg-white border-[1.5px] border-[var(--color-sand)] rounded-lg appearance-none cursor-pointer focus:outline-none focus:border-[var(--color-indigo)] focus:ring-2 focus:ring-[var(--color-indigo)]/20"
                >
                  <option value="beginner">Beginner - New to this topic</option>
                  <option value="intermediate">Intermediate - Some experience</option>
                  <option value="advanced">Advanced - Looking to master</option>
                </select>
                <ChevronDown className="absolute right-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-pebble)] pointer-events-none" />
              </div>
            </div>

            {/* Number of challenges */}
            <div>
              <label className="block text-sm font-medium text-[var(--color-charcoal)] mb-2">
                Number of Challenges: {numChallenges}
              </label>
              <input
                type="range"
                min={3}
                max={10}
                value={numChallenges}
                onChange={(e) => setNumChallenges(parseInt(e.target.value))}
                className="w-full h-2 bg-[var(--color-sand)] rounded-lg appearance-none cursor-pointer accent-[var(--color-indigo)]"
              />
              <div className="flex justify-between text-xs text-[var(--color-stone)] mt-1">
                <span>3 (Quick)</span>
                <span>10 (Comprehensive)</span>
              </div>
            </div>

            {/* Submit */}
            <div className="pt-4">
              <Button
                type="submit"
                className="w-full"
                disabled={loading || !topic.trim()}
                leftIcon={loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              >
                {loading ? "Generating Plan..." : "Generate Learning Plan"}
              </Button>
            </div>
          </form>
        </Card>
      </motion.div>

      {/* Info card */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="mt-6"
      >
        <Card padding="md" className="bg-[var(--color-indigo)]/5 border border-[var(--color-indigo)]/20">
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-lg bg-[var(--color-indigo)]/10 flex items-center justify-center flex-shrink-0">
              <BookText className="w-5 h-5 text-[var(--color-indigo)]" />
            </div>
            <div>
              <h3 className="font-medium text-[var(--color-charcoal)] mb-1">
                How it works
              </h3>
              <p className="text-sm text-[var(--color-stone)]">
                Our AI will analyze your topic and create a structured learning plan with 
                progressive challenges. Each challenge is designed to build on the previous 
                one, helping you master the subject step by step.
              </p>
            </div>
          </div>
        </Card>
      </motion.div>
    </div>
  );
}
