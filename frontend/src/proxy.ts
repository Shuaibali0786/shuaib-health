import { NextResponse, type NextRequest } from "next/server";

import { SESSION_COOKIE } from "@/admin/lib/cookie";

// Runs only for the staff app (see the matcher), so the public site never touches it.
// 1. A request for a private page without a session cookie goes to the sign-in page with the pathname
//    it wanted (the pathname only: a query string is dropped, so nothing private leaks into the URL).
// 2. The pathname is handed to the authenticated layout in a request header, so a rejected session can
//    be sent to sign-in with the same `next` value. A header the browser sent is overwritten.

const OPEN = ["/admin/login", "/admin/demo/start"];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isOpen = OPEN.some((path) => pathname === path || pathname.startsWith(`${path}/`));
  if (!isOpen && !request.cookies.has(SESSION_COOKIE)) {
    const login = new URL("/admin/login", request.url);
    login.searchParams.set("next", pathname);
    return NextResponse.redirect(login, 302);
  }
  const headers = new Headers(request.headers);
  headers.set("x-cc-pathname", pathname);
  return NextResponse.next({ request: { headers } });
}

export const config = { matcher: ["/admin", "/admin/:path*"] };
