import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/api/require-auth";
import { getTierFromStake, generateReferralCode, PARTNER_TIERS, PartnerTier } from "@/lib/partners";

export const runtime = "nodejs";

const VALID_STAKE_AMOUNTS = [1_000_000, 2_000_000, 5_000_000];
const UNSYS_TOKEN_MINT = "Dza3Bey5tvyYiPgcGRKoXKU6rNrdoNrWNVmjqePcpump";
const TREASURY_WALLET = "3Q6HtL8pmenFZjN4TQ21okC12WWKBeeH9k5g3pYT4WYY";

const HELIUS_RPC = `https://mainnet.helius-rpc.com/?api-key=${process.env.HELIUS_API_KEY}`;

async function checkTransferToTreasury(userWallet: string, stakeAmount: number): Promise<boolean> {
  // Get recent signatures for the user's wallet
  const response = await fetch(HELIUS_RPC, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: 1,
      method: "getSignaturesForAddress",
      params: [userWallet, { limit: 10 }]
    })
  });

  const data = await response.json();
  const signatures = data.result || [];

  if (signatures.length === 0) {
    return false;
  }

  // Check each signature for a transfer to treasury
  for (const sigInfo of signatures) {
    const sig = sigInfo.signature;
    
    // Get transaction details
    const txResponse = await fetch(HELIUS_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getTransaction",
        params: [sig, { maxSupportedTransactionVersion: 0, encoding: "jsonParsed" }]
      })
    });

    const txData = await txResponse.json();
    const tx = txData.result;

    if (!tx?.meta) continue;

    // Check token transfers by comparing treasury wallet balance before/after
    const postTokenBalances = tx.meta.postTokenBalances || [];
    const preTokenBalances = tx.meta.preTokenBalances || [];

    // Find treasury wallet's $UNSYS balance before and after the transaction
    const treasuryPre = preTokenBalances.find(
      (b: { owner: string; mint: string }) => b.owner === TREASURY_WALLET && b.mint === UNSYS_TOKEN_MINT
    );
    const treasuryPost = postTokenBalances.find(
      (b: { owner: string; mint: string }) => b.owner === TREASURY_WALLET && b.mint === UNSYS_TOKEN_MINT
    );

    if (treasuryPost) {
      const preAmount = parseFloat(treasuryPre?.uiTokenAmount?.uiAmountString || "0");
      const postAmount = parseFloat(treasuryPost.uiTokenAmount?.uiAmountString || "0");
      const received = postAmount - preAmount;

      // Verify the user wallet was the sender (balance decreased)
      const userPre = preTokenBalances.find(
        (b: { owner: string; mint: string }) => b.owner === userWallet && b.mint === UNSYS_TOKEN_MINT
      );
      const userPost = postTokenBalances.find(
        (b: { owner: string; mint: string }) => b.owner === userWallet && b.mint === UNSYS_TOKEN_MINT
      );

      if (userPre) {
        const userPreAmount = parseFloat(userPre.uiTokenAmount?.uiAmountString || "0");
        const userPostAmount = parseFloat(userPost?.uiTokenAmount?.uiAmountString || "0");
        const userSent = userPreAmount - userPostAmount;

        if (received >= stakeAmount && userSent >= stakeAmount) {
          return true;
        }
      }
    }
  }

  return false;
}

export async function POST(request: Request) {
  try {
    const auth = await requireAuthenticatedUser();
    if (!auth.ok) return auth.response;
    const { user, supabase } = auth;

    const { stakeAmount, walletAddress } = await request.json();

    if (!stakeAmount || !VALID_STAKE_AMOUNTS.includes(stakeAmount)) {
      return NextResponse.json(
        { error: `Invalid stake amount. Must be one of: ${VALID_STAKE_AMOUNTS.map(a => a / 1_000_000 + "M").join(", ")}` },
        { status: 400 }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .single();

    if (!profile?.username) {
      return NextResponse.json({ error: "Please set a username before becoming a partner" }, { status: 400 });
    }

    // Check if already a partner
    const { data: existingPartner } = await supabase
      .from("partners")
      .select("id")
      .eq("user_id", user.id)
      .single();

    if (existingPartner) {
      return NextResponse.json({ error: "You are already a partner" }, { status: 400 });
    }

    // Verify transfer to treasury wallet
    try {
      const hasTransferred = await checkTransferToTreasury(walletAddress, stakeAmount);
      
      if (!hasTransferred) {
        return NextResponse.json({
          error: `No transfer detected. Please send exactly ${(stakeAmount / 1_000_000)}M $UNSYS tokens to treasury wallet: ${TREASURY_WALLET}`,
          treasuryWallet: TREASURY_WALLET,
          required: stakeAmount,
        }, { status: 400 });
      }
    } catch (err) {
      console.error("Transfer verification failed:", err);
      return NextResponse.json({ error: "Failed to verify transfer. Please try again or contact support." }, { status: 500 });
    }

    const tier = getTierFromStake(stakeAmount);
    const referralCode = generateReferralCode(profile.username);

    // Check for referral code collision
    const { data: existingCode } = await supabase
      .from("partners")
      .select("id")
      .eq("referral_code", referralCode)
      .single();

    let finalReferralCode = referralCode;
    if (existingCode) {
      finalReferralCode = `${referralCode}-${Date.now().toString(36).slice(-4).toUpperCase()}`;
    }

    // Create partner record
    const { data: partner, error } = await supabase
      .from("partners")
      .insert({
        user_id: user.id,
        tier,
        stake_amount: stakeAmount,
        referral_code: finalReferralCode,
        wallet_address: walletAddress,
      })
      .select()
      .single();

    if (error) {
      console.error("Error creating partner:", error);
      return NextResponse.json({ error: "Failed to create partner record" }, { status: 500 });
    }

    // Auto-grant plan access based on stake tier
    const planAccess = stakeAmount >= 5_000_000 ? "pro" : "regular";
    await supabase
      .from("profiles")
      .update({
        wallet_address: walletAddress,
        token_tier: planAccess,
        token_validated_at: new Date().toISOString(),
        token_validity_expires_at: null, // Permanent while staked
      })
      .eq("id", user.id);

    return NextResponse.json({
      success: true,
      partner: {
        id: partner.id,
        tier,
        stakeAmount,
        referralCode: finalReferralCode,
        revenueShare: PARTNER_TIERS[tier].revenueShare * 100,
        planAccess,
      },
    });
  } catch (error) {
    console.error("Partner stake error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}