import { createAdminClient } from "@/lib/supabase/admin";
export type PartnerTier = "bronze" | "silver" | "gold";

export const PARTNER_TIERS: Record<PartnerTier, { stakeAmount: number; revenueShare: number; label: string }> = {
  bronze: { stakeAmount: 1_000_000, revenueShare: 0.10, label: "Bronze Partner" },
  silver: { stakeAmount: 2_000_000, revenueShare: 0.30, label: "Silver Partner" },
  gold: { stakeAmount: 5_000_000, revenueShare: 0.50, label: "Gold Partner" },
};

export const UNSTAKE_LOCKUP_DAYS = 60;

export function getAdminClient() {
  return createAdminClient();
}

export function getTierFromStake(stakeAmount: number): PartnerTier {
  if (stakeAmount >= 5_000_000) return "gold";
  if (stakeAmount >= 2_000_000) return "silver";
  return "bronze";
}

function generateRandomCode(length: number): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < length; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

export function generateReferralCode(username: string): string {
  return generateRandomCode(6);
}

export function calculateRevenueShare(tier: PartnerTier, amount: number): number {
  return amount * PARTNER_TIERS[tier].revenueShare;
}

export function isUnstakeLocked(unstakeRequestedAt: string | null): boolean {
  if (!unstakeRequestedAt) return false;
  const requestDate = new Date(unstakeRequestedAt);
  const now = new Date();
  const daysPassed = Math.floor((now.getTime() - requestDate.getTime()) / (1000 * 60 * 60 * 24));
  return daysPassed < UNSTAKE_LOCKUP_DAYS;
}

export function getUnstakeUnlockDate(unstakeRequestedAt: string | null): Date | null {
  if (!unstakeRequestedAt) return null;
  const requestDate = new Date(unstakeRequestedAt);
  requestDate.setDate(requestDate.getDate() + UNSTAKE_LOCKUP_DAYS);
  return requestDate;
}

export interface PartnerInfo {
  id: string;
  user_id: string;
  tier: PartnerTier;
  stake_amount: number;
  referral_code: string;
  stripe_account_id: string | null;
  stripe_account_status: string;
  total_revenue_claimed: number;
  last_payout_at: string | null;
  unstake_requested_at: string | null;
  created_at: string;
  username?: string;
  email?: string;
}

export interface PartnerStats {
  referredUsersCount: number;
  unclaimedRevenue: number;
  lifetimeEarnings: number;
  daysUntilUnlock: number | null;
}
