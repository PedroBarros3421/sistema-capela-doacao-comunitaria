import { NextResponse, type NextRequest } from "next/server";

import { hasTrustedOrigin } from "@/server/auth/csrf";

const SESSION_COOKIE_NAME = process.env.SESSION_COOKIE_NAME ?? "capela_session";

function unauthenticated(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname.startsWith("/api/admin")) {
    return NextResponse.json(
      { error: { code: "UNAUTHENTICATED", message: "Autenticação necessária" } },
      { status: 401 },
    );
  }

  const loginUrl = new URL("/admin/login", request.url);
  loginUrl.searchParams.set("returnTo", request.nextUrl.pathname);
  return NextResponse.redirect(loginUrl);
}

export function proxy(request: NextRequest): NextResponse {
  if (request.nextUrl.pathname === "/admin/login") return NextResponse.next();

  if (request.nextUrl.pathname === "/api/admin/auth/login") {
    if (!hasTrustedOrigin(request, process.env.APP_URL ?? request.nextUrl.origin)) {
      return NextResponse.json(
        { error: { code: "CSRF_ORIGIN_MISMATCH", message: "Origem da solicitação não autorizada" } },
        { status: 403 },
      );
    }

    return NextResponse.next();
  }

  if (!request.cookies.has(SESSION_COOKIE_NAME)) return unauthenticated(request);

  if (
    request.nextUrl.pathname.startsWith("/api/admin") &&
    !hasTrustedOrigin(request, process.env.APP_URL ?? request.nextUrl.origin)
  ) {
    return NextResponse.json(
      { error: { code: "CSRF_ORIGIN_MISMATCH", message: "Origem da solicitação não autorizada" } },
      { status: 403 },
    );
  }

  // This is only an optimistic boundary. Every administrative handler must call
  // requireSession/requirePermission so revocation and role changes apply immediately.
  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
