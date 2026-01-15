"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/hooks";
import { Card, Button, Badge, Progress, getStatusVariant } from "@/components/ui";
import { 
  BookText, 
  Trophy, 
  Target, 
  ArrowRight, 
  Plus,
  Clock
} from "lucide-react";
import type { Plan, Challenge } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

interface DashboardStats {
  totalPlans: number;
  activePlans: number;
  completedChallenges: number;
  totalChallenges: number;
  recentPlans: (Plan & { challenges: Challenge[] })[];
}

export default function DashboardPage() {
  const { user } = useUser();
  const supabase = createClient();
  const [stats, setStats] = useState<DashboardStats>({
    totalPlans: 0,
    activePlans: 0,
    completedChallenges: 0,
    totalChallenges: 0,
    recentPlans: [],
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchStats() {
      if (!user) return;

      try {
        // Fetch plans with challenges
        const { data: plans } = await supabase
          .from("plans")
          .select("*, challenges(*)")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (plans) {
          const totalPlans = plans.length;
          const activePlans = plans.filter(p => p.status === "active").length;
          
          let completedChallenges = 0;
          let totalChallenges = 0;
          
          plans.forEach(plan => {
            const challenges = plan.challenges || [];
            totalChallenges += challenges.length;
            completedChallenges += challenges.filter(
              (c: Challenge) => c.status === "passed"
            ).length;
          });

          setStats({
            totalPlans,
            activePlans,
            completedChallenges,
            totalChallenges,
            recentPlans: plans.slice(0, 3),
          });
        }
      } catch (error) {
        console.error("Error fetching stats:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();
  }, [user, supabase]);

  const statCards = [
    {
      label: "Active Plans",
      value: stats.activePlans,
      icon: BookText,
      color: "var(--color-indigo)",
    },
    {
      label: "Completed Challenges",
      value: stats.completedChallenges,
      icon: Trophy,
      color: "var(--color-emerald)",
    },
    {
      label: "Total Challenges",
      value: stats.totalChallenges,
      icon: Target,
      color: "var(--color-info)",
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-semibold mb-2">
          Welcome back{user?.user_metadata?.full_name ? `, ${user.user_metadata.full_name}` : ""}!
        </h1>
        <p className="text-[var(--color-stone)]">
          Track your learning progress and continue where you left off
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid sm:grid-cols-3 gap-6 mb-8">
        {statCards.map((stat, index) => (
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
              </p>
              <p className="text-[var(--color-stone)]">{stat.label}</p>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Overall progress */}
      {stats.totalChallenges > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="mb-8"
        >
          <Card padding="lg">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Overall Progress</h2>
              <span className="text-sm text-[var(--color-stone)]">
                {stats.completedChallenges} of {stats.totalChallenges} challenges completed
              </span>
            </div>
            <Progress 
              value={stats.completedChallenges} 
              max={stats.totalChallenges}
              size="lg"
              variant="success"
            />
          </Card>
        </motion.div>
      )}

      {/* Recent Plans */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Recent Plans</h2>
          <Link
            href="/dashboard/plans"
            className="text-sm text-[var(--color-indigo)] hover:underline flex items-center gap-1"
          >
            View all
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {loading ? (
          <Card padding="lg">
            <div className="text-center py-8 text-[var(--color-stone)]">
              Loading...
            </div>
          </Card>
        ) : stats.recentPlans.length === 0 ? (
          <Card padding="lg">
            <div className="text-center py-8">
              <BookText className="w-12 h-12 text-[var(--color-pebble)] mx-auto mb-4" />
              <p className="text-[var(--color-stone)] mb-4">No plans yet</p>
              <Link href="/dashboard/plans/new">
                <Button size="sm">Create Your First Plan</Button>
              </Link>
            </div>
          </Card>
        ) : (
          <div className="space-y-4">
            {stats.recentPlans.map((plan, index) => {
              const completedCount = plan.challenges.filter(
                c => c.status === "passed"
              ).length;
              const totalCount = plan.challenges.length;
              const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;

              return (
                <motion.div
                  key={plan.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.4 + index * 0.1 }}
                >
                  <Link href={`/learn/${plan.id}`}>
                    <Card hover padding="lg">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="font-semibold text-[var(--color-charcoal)] truncate">
                              {plan.topic}
                            </h3>
                            <Badge variant={getStatusVariant(plan.status)}>
                              {plan.status}
                            </Badge>
                          </div>
                          <p className="text-sm text-[var(--color-stone)] line-clamp-2 mb-3">
                            {plan.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm text-[var(--color-stone)]">
                            <span className="flex items-center gap-1">
                              <Target className="w-4 h-4" />
                              {completedCount}/{totalCount} challenges
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="w-4 h-4" />
                              {formatRelativeTime(plan.updated_at)}
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="w-24">
                            <Progress value={progress} size="sm" />
                          </div>
                          <ArrowRight className="w-5 h-5 text-[var(--color-pebble)]" />
                        </div>
                      </div>
                    </Card>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Quick Actions</h2>
        <div className="grid sm:grid-cols-2 gap-4">
          <Link href="/dashboard/plans/new">
            <Card hover padding="md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-indigo)]/10 flex items-center justify-center">
                  <Plus className="w-5 h-5 text-[var(--color-indigo)]" />
                </div>
                <div>
                  <p className="font-medium">Create New Plan</p>
                  <p className="text-sm text-[var(--color-stone)]">
                    Start learning a new topic
                  </p>
                </div>
              </div>
            </Card>
          </Link>

          <Link href="/dashboard/progress">
            <Card hover padding="md">
              <div className="flex items-center gap-4">
                <div className="w-10 h-10 rounded-lg bg-[var(--color-emerald)]/10 flex items-center justify-center">
                  <Trophy className="w-5 h-5 text-[var(--color-emerald)]" />
                </div>
                <div>
                  <p className="font-medium">View Progress</p>
                  <p className="text-sm text-[var(--color-stone)]">
                    Track your learning stats
                  </p>
                </div>
              </div>
            </Card>
          </Link>
        </div>
      </div>
    </div>
  );
}
