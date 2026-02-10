import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE = "namedrop_auth";

export function middleware(request: NextRequest) {
  const authPassword = process.env.AUTH_PASSWORD;

  // If no AUTH_PASSWORD is set, authentication is disabled — allow all requests
  if (!authPassword) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  // Allow login page and auth API
  if (pathname === "/login" || pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow static assets and Next.js internals
  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/favicon") ||
    pathname.endsWith(".ico") ||
    pathname.endsWith(".svg") ||
    pathname.endsWith(".png")
  ) {
    return NextResponse.next();
  }

  // Check auth cookie
  const cookie = request.cookies.get(AUTH_COOKIE);
  if (cookie?.value === generateToken(authPassword)) {
    return NextResponse.next();
  }

  // For API routes, return 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Redirect to login
  const loginUrl = new URL("/login", request.url);
  loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

function generateToken(password: string): string {
  // Simple hash for cookie verification
  // This is NOT cryptographic security — it's a convenience lock for self-hosted apps
  let hash = 0;
  const str = `namedrop:${password}`;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  return `nd_${Math.abs(hash).toString(36)}`;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image).*)"],
};
