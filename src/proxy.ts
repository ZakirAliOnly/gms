import { branchFromPath, scopedHeaders } from "@/lib/branch-scope";
import NextAuth from "next-auth";
import { NextResponse, type NextRequest, type NextFetchEvent } from "next/server";
import { authConfig } from "@/auth.config";
import { LOGIN_ROUTE, homeForRole } from "@/lib/routes";
import { MODULE_HEADER, moduleFromPath, firstAccessiblePath, canAccess } from "@/lib/module-access";
import { db } from "@/lib/db";

const { auth } = NextAuth(authConfig);

/**
 * Gates every page. (Next.js 16 renamed the "middleware" convention to
 * "proxy"; this is that file.)
 *
 * Unauthenticated traffic is sent to the login screen, so an unauthenticated
 * visit to any URL - including "/" - lands there. A signed-in user who opens
 * the login screen is bounced to their own home instead.
 */
export default function proxy(originalRequest: NextRequest, event: NextFetchEvent) {
  const handler = auth(async (request, event: NextFetchEvent) => {
    void event;
    const { nextUrl } = request;
    const identity = request.auth?.user;
    const record = identity
      ? await db.user.findUnique({
          where: { id: identity.id },
          include: { tenant: { select: { status: true } } },
        })
      : null;
    const user =
      record?.status === "ACTIVE" &&
      record.sessionVersion === (identity?.sessionVersion ?? 0) &&
      (record.role !== "TENANT" || record.tenant?.status === "ACTIVE")
        ? record
        : null;
    const isOnLogin = nextUrl.pathname === LOGIN_ROUTE;

    if (!user) {
      if (isOnLogin) {
        return NextResponse.next();
      }

      const target = new URL(LOGIN_ROUTE, nextUrl);

      // Remember where they were headed, but only same-origin paths - an
      // attacker-supplied absolute URL here would be an open redirect.
      const attempted = `${nextUrl.pathname}${nextUrl.search}`;
      if (nextUrl.pathname !== "/" && !nextUrl.pathname.startsWith("//")) {
        target.searchParams.set("next", attempted);
      }

      return NextResponse.redirect(target);
    }

    if (isOnLogin) {
      return NextResponse.redirect(
        new URL(
          user.role === "TENANT" ? firstAccessiblePath(user) : homeForRole(user.role),
          nextUrl
        )
      );
    }

    // Never accept a caller-supplied branch scope, including on Server Action POSTs.
    const headers = scopedHeaders(request.headers, nextUrl.pathname, user.role);
    headers.delete(MODULE_HEADER);
    const currentModule = moduleFromPath(nextUrl.pathname);
    if (currentModule && user.role === "TENANT" && !canAccess(user, currentModule)) {
      return NextResponse.redirect(new URL(firstAccessiblePath(user), nextUrl));
    }
    if (currentModule) headers.set(MODULE_HEADER, currentModule);
    const branch = branchFromPath(nextUrl.pathname);
    if (branch) {
      if (user.role !== "ADMIN")
        return NextResponse.redirect(new URL(homeForRole(user.role), nextUrl));
      // Branch workspaces have real routes. A same-server HTTP rewrite can
      // re-enter Proxy behind Nginx and strip the verified branch scope.
      return NextResponse.next({ request: { headers } });
    }
    return NextResponse.next({ request: { headers } });
  });
  return handler(originalRequest, event);
}

export const config = {
  /*
   * Run on everything except Next internals, the auth endpoints themselves,
   * and static files. Without the auth exclusion the sign-in POST would be
   * redirected before it could run.
   */
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
