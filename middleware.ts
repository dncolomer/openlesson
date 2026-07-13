import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { hasProductAccess } from "@/lib/plans";

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
  "/insights/",
  "/p/",
  "/quiz/",
  "/oauth/",
  "/docs/",
  "/platform",
  "/products",
  "/pitch",
  "/new-design",
  "/marketing/",
  "/click-moments/",
  "/community",
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

  const isDemoPage =
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/demo-app" ||
    pathname.startsWith("/demo-app/");
  const isDemoApi = pathname.startsWith("/api/demo");

  // Protected routes - require authentication
  const protectedRoutes = ["/session", "/dashboard", "/results"];
  const isProtectedRoute =
    protectedRoutes.some((route) => pathname.startsWith(route)) || isDemoPage;

  // Public routes that should skip all auth logic
  const publicRoutes = ["/pricing", "/tap/session", "/insights"];
  const isPublicRoute = publicRoutes.some((route) =>
    pathname.startsWith(route)
  );

  if (isPublicRoute) {
    return supabaseResponse;
  }

  // Auth routes - redirect to dashboard if already logged in
  const authRoutes = ["/login", "/register"];
  const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

  if (isProtectedRoute && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (isDemoApi && !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if ((isDemoPage || isDemoApi) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      if (isDemoApi) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (user && (isAuthRoute || !isSubscriptionExemptPath(pathname))) {
    const { data: profile } = await supabase
      .from("profiles")
      .select(
        "plan, subscription_status, is_admin, organization_id, token_tier, token_validity_expires_at"
      )
      .eq("id", user.id)
      .single();

    const canUseProduct = hasProductAccess(profile);

    if (isAuthRoute) {
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
    // Refresh Supabase session cookies for demo API routes (excluded from the matcher above).
    "/api/demo/:path*",
  ],
};
