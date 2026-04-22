import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

// Use service role to bypass RLS for inserting leads
const supabaseAdmin = createAdminClient();

interface LeadRequest {
  email: string;
  organization: string;
  role?: string;
  size?: string;
  audience: "enterprise" | "schools" | "hr";
  message?: string;
}

export async function POST(request: Request) {
  try {
    const body: LeadRequest = await request.json();

    // Validate required fields
    if (!body.email || !body.organization || !body.audience) {
      return NextResponse.json(
        { error: "Missing required fields: email, organization, audience" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(body.email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Validate audience
    const validAudiences = ["enterprise", "schools", "hr"];
    if (!validAudiences.includes(body.audience)) {
      return NextResponse.json(
        { error: "Invalid audience type" },
        { status: 400 }
      );
    }

    // Insert lead into database
    const { data, error } = await supabaseAdmin
      .from("leads")
      .insert({
        email: body.email.toLowerCase().trim(),
        organization: body.organization.trim(),
        role: body.role?.trim() || null,
        size: body.size || null,
        audience: body.audience,
        message: body.message?.trim() || null,
        status: "new",
      })
      .select("id")
      .single();

    if (error) {
      console.error("Error inserting lead:", error);
      return NextResponse.json(
        { error: "Failed to submit lead" },
        { status: 500 }
      );
    }

    // Optionally send notification email here in the future
    // await sendLeadNotificationEmail(body);

    return NextResponse.json({ 
      success: true, 
      id: data.id 
    });

  } catch (error) {
    console.error("Lead submission error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
