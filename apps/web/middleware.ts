import { NextRequest, NextResponse } from "next/server";

const protectedPaths = ["/dashboard", "/history", "/profile", "/resume", "/interview/new", "/interview/check", "/interview/room", "/interview/complete"];

export function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const isProtected = protectedPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isProtected) return NextResponse.next();

  if (!request.cookies.has("interview_session")) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/dashboard/:path*", "/history/:path*", "/profile/:path*", "/resume/:path*", "/interview/:path*"],
};
