"use client";

import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/hooks";
import { Card, Progress, Badge, getStatusVariant } from "@/components/ui";
import { 
  Trophy, 
  Target, 
  Flame, 
  Clock,
  BookText,
  TrendingUp
} from "lucide-react";
import type { Plan, Challenge, Submission } from "@/lib/types";

interface ProgressStats {
  totalPlans: number;
  completedPlans: number;
  totalChallenges: number;
  passedChallenges: number;
  failedChallenges: number;
  totalSubmissions: number;
  averageScore: number;
  topicsLearned: string[];
}

export default function ProgressPage() {
  const { user } = useUser();
  const supabase = createClient();
  const [stats, setStats] = useState<ProgressStats>({
    totalPlans: 0,
    completedPlans: 0,
    totalChallenges: 0,
    passedChallenges: 0,
    failedChallenges: 0,
    totalSubmissions: 0,
    averageScore: 0,
    topicsLearned: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchProgress() {
      if (!user) return;

      try {
        // Fetch plans with challenges
        const { data: plans } = await supabase
          .from("plans")
          .select("*, challenges(*)")
          .eq("user_id", user.id);

        // Fetch submissions
        const { data: submissions } = await supabase
          .from("submissions")
          .select("*")
          .eq("user_id", user.id);

        if (plans) {
          const totalPlans = plans.length;
          const completedPlans = plans.filter(p => p.status === "completed").length;
          
          let totalChallenges = 0;
          let passedChallenges = 0;
          let failedChallenges = 0;
          const topicsLearned: string[] = [];

          plans.forEach(plan => {
            const challenges = plan.challenges || [];
            totalChallenges += challenges.length;
            passedChallenges += challenges.filter((c: Challenge) => c.status === "passed").length;
            failedChallenges += challenges.filter((c: Challenge) => c.status === "failed").length;
            
            if (plan.status === "completed" || passedChallenges > 0) {
              topicsLearned.push(plan.topic);
            }
          });

          const totalSubmissions = submissions?.length || 0;
          const scoredSubmissions = submissions?.filter(s => s.score !== null) || [];
          const averageScore = scoredSubmissions.length > 0
            ? scoredSubmissions.reduce((acc, s) => acc + (s.score || 0), 0) / scoredSubmissions.length
            : 0;

          setStats({
            totalPlans,
            completedPlans,
            totalChallenges,
            passedChallenges,
            failedChallenges,
            totalSubmissions,
            averageScore: Math.round(averageScore),
            topicsLearned: topicsLearned.slice(0, 5),
          });
        }
      } catch (error) {
        console.error("Error fetching progress:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchProgress();
  }, [user, supabase]);

  const passRate = stats.totalChallenges > 0 
    ? Math.round((stats.passedChallenges / stats.totalChallenges) * 100) 
    : 0;

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">Learning Progress</h1>
        <p className="text-[var(--color-stone)]">
          Track your learning journey and achievements
        </p>
      </div>

      {/* Main stats */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {[
          { 
            label: "Challenges Passed", 
            value: stats.passedChallenges, 
            total: stats.totalChallenges,
            icon: Trophy, 
            color: "var(--color-emerald)" 
          },
          { 
            label: "Plans Completed", 
            value: stats.completedPlans, 
            total: stats.totalPlans,
            icon: BookText, 
            color: "var(--color-indigo)" 
          },
          { 
            label: "Average Score", 
            value: `${stats.averageScore}%`, 
            icon: TrendingUp, 
            color: "var(--color-info)" 
          },
          { 
            label: "Total Submissions", 
            value: stats.totalSubmissions, 
            icon: Target, 
            color: "var(--color-warning)" 
          },
        ].map((stat, index) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card padding="lg">
              <div className="flex items-start justify-between mb-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${stat.color}15` }}
                >
                  <stat.icon className="w-6 h-6" style={{ color: stat.color }} />
                </div>
              </div>
              <p className="text-3xl font-semibold mb-1">
                {loading ? "-" : stat.value}
                {stat.total !== undefined && (
                  <span className="text-lg text-[var(--color-stone)] font-normal">
                    /{stat.total}
                  </span>
                )}
              </p>
              <p className="text-[var(--color-stone)]">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Progress overview */}
      <div className="grid lg:grid-cols-2 gap-6 mb-8">
        {/* Challenge completion */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
        >
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-6">Challenge Completion</h2>
            <div className="space-y-6">
              <div>
                <div className="flex justify-between text-sm mb-2">
                  <span className="text-[var(--color-stone)]">Pass Rate</span>
                  <span className="font-medium">{passRate}%</span>
                </div>
                <Progress value={passRate} size="lg" variant="success" />
              </div>
              
              <div className="grid grid-cols-3 gap-4 pt-4 border-t border-[var(--color-sand)]">
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--color-emerald)]">
                    {loading ? "-" : stats.passedChallenges}
                  </p>
                  <p className="text-sm text-[var(--color-stone)]">Passed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--color-error)]">
                    {loading ? "-" : stats.failedChallenges}
                  </p>
                  <p className="text-sm text-[var(--color-stone)]">Failed</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-semibold text-[var(--color-stone)]">
                    {loading ? "-" : stats.totalChallenges - stats.passedChallenges - stats.failedChallenges}
                  </p>
                  <p className="text-sm text-[var(--color-stone)]">Pending</p>
                </div>
              </div>
            </div>
          </Card>
        </motion.div>

        {/* Topics learned */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
        >
          <Card padding="lg">
            <h2 className="text-lg font-semibold mb-6">Topics Explored</h2>
            {loading ? (
              <p className="text-[var(--color-stone)]">Loading...</p>
            ) : stats.topicsLearned.length === 0 ? (
              <div className="text-center py-8">
                <BookText className="w-12 h-12 text-[var(--color-pebble)] mx-auto mb-4" />
                <p className="text-[var(--color-stone)]">
                  Start learning to see your topics here
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {stats.topicsLearned.map((topic, index) => (
                  <div
                    key={index}
                    className="flex items-center gap-3 p-3 bg-[var(--color-ivory)] rounded-lg"
                  >
                    <div className="w-8 h-8 rounded-lg bg-[var(--color-indigo)]/10 flex items-center justify-center">
                      <BookText className="w-4 h-4 text-[var(--color-indigo)]" />
                    </div>
                    <span className="font-medium text-[var(--color-charcoal)] truncate">
                      {topic}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </motion.div>
      </div>

      {/* Empty state for no activity */}
      {!loading && stats.totalPlans === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6 }}
        >
          <Card padding="lg">
            <div className="text-center py-8">
              <Flame className="w-16 h-16 text-[var(--color-pebble)] mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-2">
                Start Your Learning Journey
              </h3>
              <p className="text-[var(--color-stone)] mb-6 max-w-md mx-auto">
                Create your first learning plan to begin tracking your progress. 
                The more you learn, the more achievements you&apos;ll unlock!
              </p>
            </div>
          </Card>
        </motion.div>
      )}
    </div>
  );
}
