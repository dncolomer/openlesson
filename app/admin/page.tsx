"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

interface Stats {
  totalUsers: number;
  monthlyActiveUsers: number;
  totalSessions: number;
  completedSessions: number;
  totalPlans: number;
  totalOrganizations: number;
  totalGhlSessions: number;
}

export default function AdminPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);

  useEffect(() => {
    checkAdminAndLoadStats();
  }, []);

  const checkAdminAndLoadStats = async () => {
    try {
      const { data: { user: authUser } } = await supabase.auth.getUser();
      if (!authUser) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", authUser.id)
        .single();

      if (!profile?.is_admin) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      const res = await fetch("/api/admin/stats");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Failed to load stats");
      } else {
        setStats(data);
      }
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-neutral-400">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="text-red-400">{error}</div>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto p-6">
      <h1 className="text-2xl font-bold text-white mb-2">Admin Dashboard</h1>
      <p className="text-neutral-400 mb-8">Overview and quick navigation</p>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4 mb-8">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.totalUsers || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">Total Users</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.monthlyActiveUsers || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">Monthly Active Users</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.totalSessions || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">Tutoring Blocks</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.completedSessions || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">Completed Blocks</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.totalPlans || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">Workspaces</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.totalGhlSessions || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">GHL Blocks</div>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-lg p-6">
          <div className="text-3xl font-bold text-white">{stats?.totalOrganizations || 0}</div>
          <div className="text-neutral-400 text-sm mt-1">Organizations</div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Link
          href="/admin/sessions"
          className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2">Blocks</h2>
          <p className="text-neutral-400 text-sm">
            View tutoring blocks, filter by status, and inspect linked workspaces
          </p>
        </Link>

        <Link
          href="/admin/users"
          className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2">Users</h2>
          <p className="text-neutral-400 text-sm">
            Manage users and assign Free, Regular, or Pro / Teams tiers
          </p>
        </Link>

        <Link
          href="/admin/organizations"
          className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2">Organizations</h2>
          <p className="text-neutral-400 text-sm">
            Manage organizations, members, and invite links
          </p>
        </Link>

        <Link
          href="/admin/plans"
          className="block bg-neutral-900/50 border border-neutral-800 rounded-lg p-6 hover:border-neutral-700 transition-colors"
        >
          <h2 className="text-lg font-semibold text-white mb-2">Workspaces</h2>
          <p className="text-neutral-400 text-sm">
            View verification workspaces, blocks, and GHL session activity
          </p>
        </Link>
      </div>
    </div>
  );
}