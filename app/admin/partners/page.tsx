"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { PARTNER_TIERS, PartnerTier } from "@/lib/partners";
import { DollarSign, Users, ArrowRight, RefreshCw, Crown } from "lucide-react";
import { LoadingStatusMessage } from "@/components/LoadingStatusMessage";

interface PartnerRow {
  id: string;
  userId: string;
  username: string;
  tier: PartnerTier;
  stakeAmount: number;
  referralCode: string;
  stripeAccountStatus: string;
  totalRevenueClaimed: number;
  unclaimedRevenue: number;
  referralCount: number;
  lastPayoutAt: string | null;
  unstakeRequestedAt: string | null;
  createdAt: string;
}

export default function AdminPartnersPage() {
  const router = useRouter();
  const supabase = createClient();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [partners, setPartners] = useState<PartnerRow[]>([]);
  const [payoutLoading, setPayoutLoading] = useState<string | null>(null);

  useEffect(() => {
    checkAdminAndLoadPartners();
  }, []);

  const checkAdminAndLoadPartners = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("is_admin")
        .eq("id", user.id)
        .single();

      if (!profile?.is_admin) {
        setError("Admin access required");
        setLoading(false);
        return;
      }

      loadPartners();
    } catch (err) {
      console.error("Admin check error:", err);
      setError("Failed to verify admin status");
      setLoading(false);
    }
  };

  const loadPartners = async () => {
    try {
      const res = await fetch("/api/admin/partners");
      const data = await res.json();

      if (data.error) {
        setError(data.error);
      } else {
        setPartners(data.partners || []);
      }
    } catch (err) {
      setError("Failed to load partners");
    } finally {
      setLoading(false);
    }
  };

  const handlePayout = async (partnerId: string) => {
    setPayoutLoading(partnerId);
    try {
      const res = await fetch("/api/admin/partners/payout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ partnerId }),
      });

      const data = await res.json();

      if (data.success) {
        alert(`Payout of $${data.payoutAmount.toFixed(2)} successful!`);
        loadPartners();
      } else {
        alert(data.error || "Payout failed");
      }
    } catch (err) {
      alert("Payout failed");
    } finally {
      setPayoutLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <LoadingStatusMessage message="Loading" />
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
    <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-white">Partner Management</h1>
            <p className="text-neutral-400 mt-1">Manage partners and issue payouts</p>
          </div>
          <button
            onClick={loadPartners}
            className="p-2 text-neutral-400 hover:text-white"
            title="Refresh"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>

        <div className="grid md:grid-cols-4 gap-4 mb-8">
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <Crown className="w-4 h-4" />
              <span className="text-sm">Total Partners</span>
            </div>
            <div className="text-2xl font-bold text-white">{partners.length}</div>
          </div>
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <Users className="w-4 h-4" />
              <span className="text-sm">Total Referrals</span>
            </div>
            <div className="text-2xl font-bold text-white">
              {partners.reduce((sum, p) => sum + p.referralCount, 0)}
            </div>
          </div>
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Unclaimed Revenue</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${partners.reduce((sum, p) => sum + p.unclaimedRevenue, 0).toFixed(2)}
            </div>
          </div>
          <div className="bg-neutral-900 rounded-xl p-6 border border-neutral-800">
            <div className="flex items-center gap-2 text-neutral-400 mb-2">
              <DollarSign className="w-4 h-4" />
              <span className="text-sm">Total Claimed</span>
            </div>
            <div className="text-2xl font-bold text-white">
              ${partners.reduce((sum, p) => sum + p.totalRevenueClaimed, 0).toFixed(2)}
            </div>
          </div>
        </div>

        <div className="bg-neutral-900 rounded-xl border border-neutral-800 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-800 bg-neutral-800/50">
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Partner</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Tier</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Stake</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Referrals</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Unclaimed</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Lifetime</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Stripe</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Last Payout</th>
                <th className="text-left text-xs text-neutral-400 font-medium px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {partners.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-neutral-400">
                    No partners yet
                  </td>
                </tr>
              ) : (
                partners.map((partner) => (
                  <tr key={partner.id} className="border-b border-neutral-800 last:border-0">
                    <td className="px-4 py-3">
                      <div className="text-white font-medium">{partner.username}</div>
                      <div className="text-xs text-neutral-500">{partner.referralCode}</div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          partner.tier === "gold"
                            ? "bg-amber-500/20 text-amber-400"
                            : partner.tier === "silver"
                            ? "bg-slate-400/20 text-slate-300"
                            : "bg-amber-700/20 text-amber-600"
                        }`}
                      >
                        {partner.tier}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-white text-sm">
                      {(partner.stakeAmount / 1_000_000).toFixed(0)}M
                    </td>
                    <td className="px-4 py-3 text-white text-sm">{partner.referralCount}</td>
                    <td className="px-4 py-3 text-emerald-400 font-medium">
                      ${partner.unclaimedRevenue.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-sm">
                      ${partner.totalRevenueClaimed.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`text-xs px-2 py-1 rounded-full ${
                          partner.stripeAccountStatus === "connected"
                            ? "bg-emerald-500/20 text-emerald-400"
                            : "bg-yellow-500/20 text-yellow-400"
                        }`}
                      >
                        {partner.stripeAccountStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-neutral-400 text-sm">
                      {partner.lastPayoutAt
                        ? new Date(partner.lastPayoutAt).toLocaleDateString()
                        : "Never"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => handlePayout(partner.id)}
                        disabled={payoutLoading === partner.id || partner.unclaimedRevenue <= 0 || partner.stripeAccountStatus !== "connected"}
                        className="px-3 py-1.5 bg-emerald-600 text-white text-sm rounded-lg hover:bg-emerald-500 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                      >
                        {payoutLoading === partner.id ? (
                          "..."
                        ) : (
                          <>
                            Payout
                            <ArrowRight className="w-3 h-3" />
                          </>
                        )}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
    </div>
  );
}