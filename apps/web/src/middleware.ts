import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const SESSION_COOKIE = "mederp_session";

const publicPaths = ["/login", "/signup", "/signup/verify", "/forgot-password", "/register-hospital", "/terms"];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublicPage = publicPaths.some(
    (path) => pathname === path || pathname.startsWith(`${path}/`),
  );
  const isPublicApi =
    pathname.startsWith("/api/auth/") || pathname.startsWith("/api/public/") || pathname === "/api/health";
  const isLoggedIn =
    Boolean(request.cookies.get(SESSION_COOKIE)?.value) ||
    (request.headers.get("authorization") ?? "").toLowerCase().startsWith("bearer ");

  if ((isPublicPage || isPublicApi) && isLoggedIn && (pathname === "/login" || pathname === "/signup")) {
    return NextResponse.redirect(new URL("/", request.url));
  }

  if (isPublicPage || isPublicApi) {
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${request.nextUrl.search}`);
    return NextResponse.redirect(loginUrl);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-pathname", pathname);
  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
