import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasProductAccess } from "@/lib/plans";
import { ensureTrialExpiryApplied } from "@/lib/usage-metrics";

const SUBSCRIPTION_EXEMPT_PREFIXES = [
  "/pricing",
  "/login",
  "/register",
  "/reset-password",
  "/auth/",
  "/invite/",
  "/terms",
  "/privacy",
  "/cookies",
  "/legal",
  "/tap/session/",
  "/ile/session/",
  "/tapbench/",
  "/portal/",
  "/practice-portal/",
  "/insights/",
  "/p/",
  "/quiz/",
  "/oauth/",
  "/docs/",
  "/use-cases",
  "/products",
  "/pitch",
  "/sales",
  "/new-design",
  "/marketing/",
  "/click-moments/",
  "/community",
  "/all-you-can-learn",
  "/community-events",
  "/learn/",
];

function isSubscriptionExemptPath(pathname: string): boolean {
  if (pathname === "/") return true;
  return SUBSCRIPTION_EXEMPT_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(prefix)
  );
}

export async function middleware(request: NextRequest) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Skip middleware if Supabase is not configured
  if (!supabaseUrl || !supabaseAnonKey) {
    return NextResponse.next();
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refresh session if expired
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // Protected routes - require authentication
  const protectedRoutes = ["/session", "/dashboard", "/results"];
  const isProtectedRoute = protectedRoutes.some((route) => pathname.startsWith(route));

  // Public routes that should skip all auth logic (shareable TAP/ILE guest links + Practice Portal)
  const publicRoutes = [
    "/pricing",
    "/tap/session",
    "/ile/session",
    "/tapbench",
    "/portal",
    "/practice-portal",
    "/insights",
    "/learn",
  ];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return supabaseResponse;
  }

  if (pathname.startsWith("/register")) {
    const sessionId = request.nextUrl.searchParams.get("session_id");
    const returnUrl = request.nextUrl.searchParams.get("returnUrl");
    const inviteToken =
      request.nextUrl.searchParams.get("inviteToken") ||
      request.nextUrl.searchParams.get("invite");
    const isInviteSignup =
      Boolean(inviteToken?.trim()) ||
      Boolean(returnUrl?.startsWith("/invite/"));
    // Paid checkout (session_id) or organization invite signup only.
    if (!sessionId && !isInviteSignup) {
      return NextResponse.redirect(new URL("/pricing", request.url));
    }
  }

  // Auth routes - redirect to dashboard if already logged in
  const authRoutes = ["/login", "/register"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (user && (isAuthRoute || !isSubscriptionExemptPath(pathname))) {
    const { data: rawProfile } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_status, is_admin, organization_id, token_tier, token_validity_expires_at, current_period_end"
      )
      .eq("id", user.id)
      .single();

    const profile = rawProfile
      ? await ensureTrialExpiryApplied(supabase, user.id, rawProfile)
      : null;

    let orgBilling: {
      id: string;
      plan: string | null;
      subscription_status: string | null;
      current_period_end: string | null;
      billing_mode: string | null;
      archived_at: string | null;
    } | null = null;

    if (profile?.organization_id) {
      const { data: org } = await supabase
        .from("organizations")
        .select("id, plan, subscription_status, current_period_end, billing_mode, archived_at")
        .eq("id", profile.organization_id)
        .maybeSingle();
      orgBilling = org;
    }

    const canUseProduct = hasProductAccess(profile, orgBilling);

    if (isAuthRoute) {
      // Prefer completing an invite over bouncing paid/inactive users to pricing.
      const inviteTokenParam =
        request.nextUrl.searchParams.get("inviteToken") ||
        request.nextUrl.searchParams.get("invite");
      const inviteReturn = request.nextUrl.searchParams.get("returnUrl");
      const postAuthRedirect = request.nextUrl.searchParams.get("redirect");

      if (inviteTokenParam?.trim()) {
        return NextResponse.redirect(
          new URL(`/invite/${encodeURIComponent(inviteTokenParam.trim())}`, request.url)
        );
      }
      if (inviteReturn?.startsWith("/invite/")) {
        return NextResponse.redirect(new URL(inviteReturn, request.url));
      }
      if (postAuthRedirect?.startsWith("/invite/")) {
        return NextResponse.redirect(new URL(postAuthRedirect, request.url));
      }

      return NextResponse.redirect(
        new URL(canUseProduct ? "/dashboard" : "/pricing", request.url)
      );
    }

    if (!canUseProduct) {
      const pricingUrl = new URL("/pricing", request.url);
      pricingUrl.searchParams.set("required", "1");
      return NextResponse.redirect(pricingUrl);
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)",
  ],
};
