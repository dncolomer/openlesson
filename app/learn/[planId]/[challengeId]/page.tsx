"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/hooks";
import { Card, Button, Badge, Textarea, Container, Progress, getStatusVariant } from "@/components/ui";
import { 
  ArrowLeft, 
  ArrowRight,
  Send,
  Loader2,
  CheckCircle2,
  XCircle,
  Lightbulb,
  ChevronDown,
  ChevronUp,
  RefreshCw,
  Target
} from "lucide-react";
import type { Plan, Challenge, Submission } from "@/lib/types";
import { cn } from "@/lib/utils";

export default function ChallengePage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const supabase = createClient();
  
  const [plan, setPlan] = useState<Plan | null>(null);
  const [challenge, setChallenge] = useState<Challenge | null>(null);
  const [allChallenges, setAllChallenges] = useState<Challenge[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [showHints, setShowHints] = useState(false);
  const [latestResult, setLatestResult] = useState<{
    passed: boolean;
    feedback: string;
    score: number;
  } | null>(null);

  const planId = params.planId as string;
  const challengeId = params.challengeId as string;

  useEffect(() => {
    async function fetchData() {
      if (!user || !planId || !challengeId) return;

      try {
        // Fetch plan
        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("*")
          .eq("id", planId)
          .eq("user_id", user.id)
          .single();

        if (planError) throw planError;

        // Fetch all challenges
        const { data: challengesData, error: challengesError } = await supabase
          .from("challenges")
          .select("*")
          .eq("plan_id", planId)
          .order("order_index", { ascending: true });

        if (challengesError) throw challengesError;

        // Find current challenge
        const currentChallenge = challengesData?.find(c => c.id === challengeId);
        if (!currentChallenge) throw new Error("Challenge not found");

        // Fetch submissions for this challenge
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*")
          .eq("challenge_id", challengeId)
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });

        setPlan(planData);
        setAllChallenges(challengesData || []);
        setChallenge(currentChallenge);
        setSubmissions(submissionsData || []);

        // If challenge is pending, mark it as in_progress
        if (currentChallenge.status === "pending") {
          await supabase
            .from("challenges")
            .update({ status: "in_progress" })
            .eq("id", challengeId);
          setChallenge({ ...currentChallenge, status: "in_progress" });
        }
      } catch (err) {
        console.error("Error fetching data:", err);
        setError("Challenge not found or you don't have access.");
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [user, planId, challengeId, supabase]);

  const handleSubmit = async () => {
    if (!content.trim() || !user || !challenge) return;

    setSubmitting(true);
    setError(null);
    setLatestResult(null);

    try {
      const response = await fetch("/api/submissions/evaluate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          challenge_id: challengeId,
          content: content.trim(),
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to evaluate submission");
      }

      // Show result
      setLatestResult({
        passed: data.passed,
        feedback: data.feedback,
        score: data.score,
      });

      // Update local state
      setSubmissions([data.submission, ...submissions]);
      
      if (data.passed) {
        setChallenge({ ...challenge, status: "passed" });
      }

      setContent("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setSubmitting(false);
    }
  };

  const currentIndex = allChallenges.findIndex(c => c.id === challengeId);
  const prevChallenge = currentIndex > 0 ? allChallenges[currentIndex - 1] : null;
  const nextChallenge = currentIndex < allChallenges.length - 1 ? allChallenges[currentIndex + 1] : null;
  const completedCount = allChallenges.filter(c => c.status === "passed").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-indigo)]" />
      </div>
    );
  }

  if (error || !plan || !challenge) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)]">
        <Container className="py-12">
          <Card padding="lg">
            <div className="text-center py-8">
              <Target className="w-16 h-16 text-[var(--color-pebble)] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[var(--color-charcoal)] mb-2">
                {error || "Challenge not found"}
              </h2>
              <Link href={`/learn/${planId}`}>
                <Button>Back to Plan</Button>
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  const isPassed = challenge.status === "passed";

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-sand)] sticky top-0 z-10">
        <Container>
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <Link
                href={`/learn/${planId}`}
                className="inline-flex items-center gap-2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                {plan.topic}
              </Link>
              <span className="text-sm text-[var(--color-stone)]">
                Challenge {currentIndex + 1} of {allChallenges.length}
              </span>
            </div>
            
            {/* Progress */}
            <Progress 
              value={completedCount} 
              max={allChallenges.length} 
              size="sm"
            />
          </div>
        </Container>
      </header>

      {/* Main content */}
      <main className="py-8">
        <Container size="md">
          {/* Challenge card */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <Card padding="lg" className="mb-6">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <span className="text-sm text-[var(--color-stone)]">Challenge {currentIndex + 1}</span>
                  <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
                    {challenge.title}
                  </h1>
                </div>
                <Badge variant={getStatusVariant(challenge.status)} size="md">
                  {challenge.status.replace("_", " ")}
                </Badge>
              </div>

              <p className="text-[var(--color-graphite)] mb-6 leading-relaxed">
                {challenge.description}
              </p>

              {/* Success criteria */}
              <div className="bg-[var(--color-ivory)] rounded-xl p-4 mb-6">
                <h3 className="text-sm font-medium text-[var(--color-charcoal)] mb-2">
                  Success Criteria
                </h3>
                <p className="text-sm text-[var(--color-graphite)]">
                  {challenge.success_criteria}
                </p>
              </div>

              {/* Hints (if available) */}
              {challenge.hints && challenge.hints.length > 0 && (
                <div className="border-t border-[var(--color-sand)] pt-4">
                  <button
                    onClick={() => setShowHints(!showHints)}
                    className="flex items-center gap-2 text-sm text-[var(--color-indigo)] hover:underline"
                  >
                    <Lightbulb className="w-4 h-4" />
                    {showHints ? "Hide hints" : `Show ${challenge.hints.length} hint${challenge.hints.length > 1 ? "s" : ""}`}
                    {showHints ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>
                  
                  <AnimatePresence>
                    {showHints && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <ul className="mt-3 space-y-2">
                          {challenge.hints.map((hint, index) => (
                            <li 
                              key={index}
                              className="text-sm text-[var(--color-graphite)] pl-4 border-l-2 border-[var(--color-indigo)]/30"
                            >
                              {hint}
                            </li>
                          ))}
                        </ul>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              )}
            </Card>
          </motion.div>

          {/* Result feedback */}
          <AnimatePresence>
            {latestResult && (
              <motion.div
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                className="mb-6"
              >
                <Card 
                  padding="lg"
                  className={cn(
                    "border-2",
                    latestResult.passed 
                      ? "border-[var(--color-emerald)] bg-[var(--color-emerald)]/5"
                      : "border-[var(--color-error)] bg-[var(--color-error)]/5"
                  )}
                >
                  <div className="flex items-start gap-4">
                    {latestResult.passed ? (
                      <CheckCircle2 className="w-8 h-8 text-[var(--color-emerald)] flex-shrink-0" />
                    ) : (
                      <XCircle className="w-8 h-8 text-[var(--color-error)] flex-shrink-0" />
                    )}
                    <div className="flex-1">
                      <div className="flex items-center justify-between mb-2">
                        <h3 className={cn(
                          "font-semibold",
                          latestResult.passed ? "text-[var(--color-emerald-dark)]" : "text-[var(--color-error)]"
                        )}>
                          {latestResult.passed ? "Challenge Passed!" : "Not quite right"}
                        </h3>
                        <span className="text-sm font-medium">
                          Score: {latestResult.score}/100
                        </span>
                      </div>
                      <p className="text-[var(--color-graphite)]">{latestResult.feedback}</p>
                    </div>
                  </div>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Submission form */}
          {!isPassed && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
            >
              <Card padding="lg" className="mb-6">
                <h2 className="text-lg font-semibold mb-4">Your Answer</h2>
                
                {error && (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm mb-4">
                    {error}
                  </div>
                )}

                <Textarea
                  placeholder="Type your answer here..."
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  className="mb-4 min-h-[200px]"
                />

                <div className="flex items-center justify-between">
                  <p className="text-sm text-[var(--color-stone)]">
                    {submissions.length > 0 && `${submissions.length} previous attempt${submissions.length > 1 ? "s" : ""}`}
                  </p>
                  <Button
                    onClick={handleSubmit}
                    disabled={!content.trim() || submitting}
                    leftIcon={submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                  >
                    {submitting ? "Evaluating..." : "Submit Answer"}
                  </Button>
                </div>
              </Card>
            </motion.div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between">
            {prevChallenge ? (
              <Link href={`/learn/${planId}/${prevChallenge.id}`}>
                <Button variant="ghost" leftIcon={<ArrowLeft className="w-4 h-4" />}>
                  Previous
                </Button>
              </Link>
            ) : (
              <div />
            )}

            {nextChallenge ? (
              <Link href={`/learn/${planId}/${nextChallenge.id}`}>
                <Button 
                  variant={isPassed ? "primary" : "secondary"}
                  rightIcon={<ArrowRight className="w-4 h-4" />}
                >
                  Next Challenge
                </Button>
              </Link>
            ) : isPassed ? (
              <Link href={`/learn/${planId}`}>
                <Button rightIcon={<CheckCircle2 className="w-4 h-4" />}>
                  Complete Plan
                </Button>
              </Link>
            ) : (
              <div />
            )}
          </div>

          {/* Previous submissions */}
          {submissions.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mt-8"
            >
              <h2 className="text-lg font-semibold mb-4">Previous Attempts</h2>
              <div className="space-y-4">
                {submissions.slice(0, 5).map((submission, index) => (
                  <Card key={submission.id} padding="md" className="bg-[var(--color-ivory)]">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <Badge variant={getStatusVariant(submission.status)}>
                        {submission.status}
                      </Badge>
                      <span className="text-sm text-[var(--color-stone)]">
                        {submission.score !== null && `Score: ${submission.score}/100`}
                      </span>
                    </div>
                    <p className="text-sm text-[var(--color-graphite)] line-clamp-3 mb-2">
                      {submission.content}
                    </p>
                    {submission.feedback && (
                      <p className="text-sm text-[var(--color-stone)] italic">
                        Feedback: {submission.feedback}
                      </p>
                    )}
                  </Card>
                ))}
              </div>
            </motion.div>
          )}
        </Container>
      </main>
    </div>
  );
}
