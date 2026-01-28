import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

function maintenanceResponse() {
  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maintenance | OpenLesson</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      background: linear-gradient(135deg, #fafafa 0%, #f0f4f8 100%);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      padding: 20px;
    }
    .container {
      text-align: center;
      max-width: 500px;
    }
    .icon {
      font-size: 64px;
      margin-bottom: 24px;
    }
    h1 {
      font-size: 2rem;
      margin-bottom: 16px;
      color: #1a1a2e;
    }
    p {
      font-size: 1.1rem;
      line-height: 1.6;
      color: #64748b;
      margin-bottom: 24px;
    }
    .retry-btn {
      display: inline-block;
      padding: 12px 32px;
      background: #10b981;
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: background 0.2s;
    }
    .retry-btn:hover {
      background: #059669;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">📚</div>
    <h1>Under Maintenance</h1>
    <p>We're performing some maintenance to improve your learning experience. Please check back in a few moments.</p>
    <a href="/" class="retry-btn">Try Again</a>
  </div>
</body>
</html>`;
  return new NextResponse(html, {
    status: 503,
    headers: { "Content-Type": "text/html", "Retry-After": "60" },
  });
}

export async function middleware(request: NextRequest) {
  try {
    // Skip middleware if Supabase is not configured
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.next();
    }
    
    let supabaseResponse = NextResponse.next({
      request,
    });

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
            supabaseResponse = NextResponse.next({
              request,
            });
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
    const protectedRoutes = ["/dashboard", "/learn"];
    const isProtectedRoute = protectedRoutes.some((route) =>
      pathname.startsWith(route)
    );

    // Auth routes - redirect to dashboard if already logged in
    const authRoutes = ["/login", "/register", "/forgot-password"];
    const isAuthRoute = authRoutes.some((route) => pathname.startsWith(route));

    if (isProtectedRoute && !user) {
      const redirectUrl = new URL("/login", request.url);
      redirectUrl.searchParams.set("redirect", pathname);
      return NextResponse.redirect(redirectUrl);
    }

    if (isAuthRoute && user) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    return supabaseResponse;
  } catch (error) {
    console.error("Middleware error:", error);
    return maintenanceResponse();
  }
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     * - api routes
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$|api).*)",
  ],
};
