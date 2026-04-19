import { NextRequest, NextResponse } from "next/server";

// Simple password protection via middleware
// Password is set via environment variable AUTH_PASSWORD
// After correct password, a cookie is set and user is not prompted again

export function middleware(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  // Skip API routes and static files
  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const authCookie = request.cookies.get("stay-tracker-auth");
  const password = process.env.AUTH_PASSWORD || "stay2026";

  // Already authenticated
  if (authCookie?.value === password) {
    return NextResponse.next();
  }

  // Login form submission
  if (pathname === "/api/auth/login") {
    return NextResponse.next();
  }

  // Show login page
  if (pathname === "/login") {
    return NextResponse.next();
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
