"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/hooks";
import { Card, Button, Badge, Progress, Container, getStatusVariant } from "@/components/ui";
import { 
  ArrowLeft, 
  ArrowRight,
  BookOpen,
  Target,
  CheckCircle2,
  Circle,
  Clock,
  Loader2,
  Play
} from "lucide-react";
import type { Plan, Challenge } from "@/lib/types";
import { formatDate, cn } from "@/lib/utils";

export default function PlanPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useUser();
  const supabase = createClient();
  const [plan, setPlan] = useState<Plan | null>(null);
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const planId = params.planId as string;

  useEffect(() => {
    async function fetchPlan() {
      if (!user || !planId) return;

      try {
        // Fetch plan
        const { data: planData, error: planError } = await supabase
          .from("plans")
          .select("*")
          .eq("id", planId)
          .eq("user_id", user.id)
          .single();

        if (planError) throw planError;

        // Fetch challenges
        const { data: challengesData, error: challengesError } = await supabase
          .from("challenges")
          .select("*")
          .eq("plan_id", planId)
          .order("order_index", { ascending: true });

        if (challengesError) throw challengesError;

        setPlan(planData);
        setChallenges(challengesData || []);
      } catch (err) {
        console.error("Error fetching plan:", err);
        setError("Plan not found or you don't have access to it.");
      } finally {
        setLoading(false);
      }
    }

    fetchPlan();
  }, [user, planId, supabase]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)] flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-[var(--color-indigo)]" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="min-h-screen bg-[var(--color-cream)]">
        <Container className="py-12">
          <Card padding="lg">
            <div className="text-center py-8">
              <BookOpen className="w-16 h-16 text-[var(--color-pebble)] mx-auto mb-4" />
              <h2 className="text-xl font-semibold text-[var(--color-charcoal)] mb-2">
                {error || "Plan not found"}
              </h2>
              <p className="text-[var(--color-stone)] mb-6">
                The plan you&apos;re looking for doesn&apos;t exist or you don&apos;t have access.
              </p>
              <Link href="/dashboard/plans">
                <Button>Go to My Plans</Button>
              </Link>
            </div>
          </Card>
        </Container>
      </div>
    );
  }

  const completedCount = challenges.filter(c => c.status === "passed").length;
  const progress = challenges.length > 0 ? (completedCount / challenges.length) * 100 : 0;
  
  // Find the next challenge to work on
  const nextChallenge = challenges.find(c => c.status === "pending" || c.status === "in_progress");

  return (
    <div className="min-h-screen bg-[var(--color-cream)]">
      {/* Header */}
      <header className="bg-white border-b border-[var(--color-sand)]">
        <Container>
          <div className="py-4">
            <Link
              href="/dashboard/plans"
              className="inline-flex items-center gap-2 text-[var(--color-stone)] hover:text-[var(--color-charcoal)] mb-4 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Plans
            </Link>
            
            <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-4">
              <div className="flex-1">
                <div className="flex items-center gap-3 mb-2">
                  <h1 className="text-2xl font-semibold text-[var(--color-charcoal)]">
                    {plan.topic}
                  </h1>
                  <Badge variant={getStatusVariant(plan.status)}>{plan.status}</Badge>
                </div>
                <p className="text-[var(--color-stone)] mb-4">{plan.description}</p>
                <div className="flex items-center gap-4 text-sm text-[var(--color-stone)]">
                  <span className="flex items-center gap-1">
                    <Target className="w-4 h-4" />
                    {completedCount}/{challenges.length} challenges
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-4 h-4" />
                    Started {formatDate(plan.created_at)}
                  </span>
                </div>
              </div>
              
              {nextChallenge && (
                <Link href={`/learn/${planId}/${nextChallenge.id}`}>
                  <Button rightIcon={<Play className="w-4 h-4" />}>
                    {nextChallenge.status === "in_progress" ? "Continue" : "Start Next Challenge"}
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </Container>
      </header>

      {/* Progress bar */}
      <div className="bg-white border-b border-[var(--color-sand)]">
        <Container>
          <div className="py-4">
            <div className="flex items-center justify-between text-sm mb-2">
              <span className="text-[var(--color-stone)]">Overall Progress</span>
              <span className="font-medium text-[var(--color-indigo)]">{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} size="md" />
          </div>
        </Container>
      </div>

      {/* Challenges list */}
      <main className="py-8">
        <Container>
          <h2 className="text-xl font-semibold mb-6">Challenges</h2>
          
          <div className="space-y-4">
            {challenges.map((challenge, index) => {
              const isCompleted = challenge.status === "passed";
              const isCurrent = challenge.status === "in_progress";
              const isFailed = challenge.status === "failed";
              const isPending = challenge.status === "pending";
              
              return (
                <motion.div
                  key={challenge.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                >
                  <Link href={`/learn/${planId}/${challenge.id}`}>
                    <Card 
                      hover 
                      padding="none"
                      className={cn(
                        "overflow-hidden",
                        isCurrent && "ring-2 ring-[var(--color-indigo)]"
                      )}
                    >
                      <div className="flex">
                        {/* Status indicator */}
                        <div 
                          className={cn(
                            "w-16 flex-shrink-0 flex items-center justify-center",
                            isCompleted && "bg-[var(--color-emerald)]/10",
                            isCurrent && "bg-[var(--color-indigo)]/10",
                            isFailed && "bg-[var(--color-error)]/10",
                            isPending && "bg-[var(--color-ivory)]"
                          )}
                        >
                          {isCompleted ? (
                            <CheckCircle2 className="w-6 h-6 text-[var(--color-emerald)]" />
                          ) : isCurrent ? (
                            <div className="w-6 h-6 rounded-full border-2 border-[var(--color-indigo)] flex items-center justify-center">
                              <div className="w-2 h-2 rounded-full bg-[var(--color-indigo)]" />
                            </div>
                          ) : isFailed ? (
                            <Circle className="w-6 h-6 text-[var(--color-error)]" />
                          ) : (
                            <Circle className="w-6 h-6 text-[var(--color-pebble)]" />
                          )}
                        </div>
                        
                        {/* Content */}
                        <div className="flex-1 p-5">
                          <div className="flex items-start justify-between gap-4">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm text-[var(--color-stone)]">
                                  Challenge {index + 1}
                                </span>
                                <Badge variant={getStatusVariant(challenge.status)} size="sm">
                                  {challenge.status.replace("_", " ")}
                                </Badge>
                              </div>
                              <h3 className="font-semibold text-[var(--color-charcoal)] mb-2">
                                {challenge.title}
                              </h3>
                              <p className="text-sm text-[var(--color-stone)] line-clamp-2">
                                {challenge.description}
                              </p>
                            </div>
                            <ArrowRight className="w-5 h-5 text-[var(--color-pebble)] flex-shrink-0" />
                          </div>
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>

          {challenges.length === 0 && (
            <Card padding="lg">
              <div className="text-center py-8">
                <Target className="w-12 h-12 text-[var(--color-pebble)] mx-auto mb-4" />
                <p className="text-[var(--color-stone)]">
                  No challenges found for this plan.
                </p>
              </div>
            </Card>
          )}
        </Container>
      </main>
    </div>
  );
}
