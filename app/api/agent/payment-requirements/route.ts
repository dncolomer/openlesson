import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function GET() {
  const walletAddress = process.env.X402_WALLET_ADDRESS;
  const network = process.env.X402_NETWORK || "base-sepolia";

  if (!walletAddress) {
    return NextResponse.json({
      error: "x402 payments not configured",
      message: "This API does not currently accept crypto payments",
    });
  }

  const paymentRequirements = {
    plan: {
      endpoint: "/api/agent/workspace",
      price: 50,
      currency: "usd",
      description: "Generate a learning plan",
      paymentRequirements: {
        scheme: "exact",
        network,
        payTo: walletAddress,
        maxAmountRequired: "50",
        instructions: [
          {
            protocol: "https",
            url: `https://x402.org/facilitators/${network}`,
          },
        ],
      },
    },
    session_start: {
      endpoint: "/api/agent/session/start",
      price: 100,
      currency: "usd",
      description: "Start a tutoring session",
      paymentRequirements: {
        scheme: "exact",
        network,
        payTo: walletAddress,
        maxAmountRequired: "100",
        instructions: [
          {
            protocol: "https",
            url: `https://x402.org/facilitators/${network}`,
          },
        ],
      },
    },
    session_analyze: {
      endpoint: "/api/agent/session/analyze",
      price: 10,
      currency: "usd",
      description: "Analyze audio chunk (bundled with session start)",
      note: "Included in session start payment",
    },
  };

  return NextResponse.json({
    version: 1,
    network,
    walletAddress,
    currency: "usd",
    endpoints: paymentRequirements,
  });
}
