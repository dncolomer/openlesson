import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

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

  if (pathname === "/evidence-api-demo" || pathname.startsWith("/evidence-api-demo/")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = pathname.replace(/^\/evidence-api-demo/, "/demo");
    return NextResponse.redirect(redirectUrl);
  }

  const isDemoPage =
    pathname === "/demo" ||
    pathname.startsWith("/demo/") ||
    pathname === "/demo-app" ||
    pathname.startsWith("/demo-app/");
  const isEvidenceApiDemoApi = pathname.startsWith("/api/evidence-api-demo");

  // Protected routes - require authentication
  const protectedRoutes = ["/session", "/dashboard", "/results"];
  const isProtectedRoute =
    protectedRoutes.some((route) => pathname.startsWith(route)) || isDemoPage;

  // Public routes that should skip all auth logic
  const publicRoutes = ["/pricing", "/tap/session", "/ghl-score/session", "/insights"];
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

  if (isEvidenceApiDemoApi && !user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  if ((isDemoPage || isEvidenceApiDemoApi) && user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("is_admin")
      .eq("id", user.id)
      .single();

    if (!profile?.is_admin) {
      if (isEvidenceApiDemoApi) {
        return NextResponse.json({ error: "Admin access required" }, { status: 403 });
      }
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }
  }

  if (isAuthRoute && user) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)",
    // Refresh Supabase session cookies for demo API routes (excluded from the matcher above).
    "/api/evidence-api-demo/:path*",
  ],
};
