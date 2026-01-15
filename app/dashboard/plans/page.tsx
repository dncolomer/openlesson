"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { createClient } from "@/lib/supabase/client";
import { useUser } from "@/lib/supabase/hooks";
import { Card, Button, Badge, Progress, getStatusVariant } from "@/components/ui";
import { 
  BookText, 
  Plus, 
  Target, 
  Clock, 
  ArrowRight,
  Search,
  Filter
} from "lucide-react";
import type { Plan, Challenge } from "@/lib/types";
import { formatRelativeTime } from "@/lib/utils";

type FilterStatus = "all" | "active" | "completed" | "archived";

export default function PlansPage() {
  const { user } = useUser();
  const supabase = createClient();
  const [plans, setPlans] = useState<(Plan & { challenges: Challenge[] })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterStatus>("all");
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    async function fetchPlans() {
      if (!user) return;

      try {
        const { data } = await supabase
          .from("plans")
          .select("*, challenges(*)")
          .eq("user_id", user.id)
          .order("updated_at", { ascending: false });

        if (data) {
          setPlans(data);
        }
      } catch (error) {
        console.error("Error fetching plans:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchPlans();
  }, [user, supabase]);

  const filteredPlans = plans.filter(plan => {
    // Status filter
    if (filter !== "all" && plan.status !== filter) return false;
    
    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        plan.topic.toLowerCase().includes(query) ||
        plan.description.toLowerCase().includes(query)
      );
    }
    
    return true;
  });

  const statusCounts = {
    all: plans.length,
    active: plans.filter(p => p.status === "active").length,
    completed: plans.filter(p => p.status === "completed").length,
    archived: plans.filter(p => p.status === "archived").length,
  };

  return (
    <div>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-3xl font-semibold mb-2">My Plans</h1>
          <p className="text-[var(--color-stone)]">
            Manage and track all your learning plans
          </p>
        </div>
        <Link href="/dashboard/plans/new">
          <Button leftIcon={<Plus className="w-4 h-4" />}>
            New Plan
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-pebble)]" />
          <input
            type="text"
            placeholder="Search plans..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-12 pr-4 py-3 bg-white border border-[var(--color-sand)] rounded-lg focus:outline-none focus:border-[var(--color-indigo)] focus:ring-2 focus:ring-[var(--color-indigo)]/20"
          />
        </div>

        {/* Status filter */}
        <div className="flex items-center gap-2 flex-wrap">
          {(["all", "active", "completed", "archived"] as FilterStatus[]).map((status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? "bg-[var(--color-indigo)] text-white"
                  : "bg-white text-[var(--color-graphite)] hover:bg-[var(--color-ivory)]"
              }`}
            >
              {status.charAt(0).toUpperCase() + status.slice(1)} ({statusCounts[status]})
            </button>
          ))}
        </div>
      </div>

      {/* Plans list */}
      {loading ? (
        <Card padding="lg">
          <div className="text-center py-8 text-[var(--color-stone)]">
            Loading plans...
          </div>
        </Card>
      ) : filteredPlans.length === 0 ? (
        <Card padding="lg">
          <div className="text-center py-12">
            <BookText className="w-16 h-16 text-[var(--color-pebble)] mx-auto mb-4" />
            {plans.length === 0 ? (
              <>
                <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-2">
                  No plans yet
                </h3>
                <p className="text-[var(--color-stone)] mb-6">
                  Create your first learning plan to get started
                </p>
                <Link href="/dashboard/plans/new">
                  <Button>Create Your First Plan</Button>
                </Link>
              </>
            ) : (
              <>
                <h3 className="text-lg font-semibold text-[var(--color-charcoal)] mb-2">
                  No matching plans
                </h3>
                <p className="text-[var(--color-stone)]">
                  Try adjusting your search or filter
                </p>
              </>
            )}
          </div>
        </Card>
      ) : (
        <div className="space-y-4">
          {filteredPlans.map((plan, index) => {
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
                transition={{ delay: index * 0.05 }}
              >
                <Link href={`/learn/${plan.id}`}>
                  <Card hover padding="lg">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <h3 className="font-semibold text-lg text-[var(--color-charcoal)] truncate">
                            {plan.topic}
                          </h3>
                          <Badge variant={getStatusVariant(plan.status)}>
                            {plan.status}
                          </Badge>
                        </div>
                        <p className="text-[var(--color-stone)] line-clamp-2 mb-4">
                          {plan.description}
                        </p>
                        <div className="flex items-center gap-6 text-sm text-[var(--color-stone)]">
                          <span className="flex items-center gap-1">
                            <Target className="w-4 h-4" />
                            {completedCount}/{totalCount} challenges
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="w-4 h-4" />
                            Updated {formatRelativeTime(plan.updated_at)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-6">
                        <div className="hidden sm:block w-32">
                          <div className="text-right text-sm text-[var(--color-stone)] mb-1">
                            {Math.round(progress)}%
                          </div>
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
  );
}
