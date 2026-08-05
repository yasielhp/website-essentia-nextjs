import createMiddleware from "next-intl/middleware";
import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@insforge/sdk/ssr/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createMiddleware(routing);

/**
 * Paths next-intl must not touch: they live outside the `[locale]` tree, so
 * they have no entry in `routing.pathnames`. The middleware could not resolve
 * them and answered 404 — which is what every "My account" link in the header,
 * and the redirect after signing in, had been getting.
 */
const NON_LOCALE = /^\/(dashboard|account|api)(\/|$)/;

export async function proxy(request: NextRequest) {
  const response = NON_LOCALE.test(request.nextUrl.pathname)
    ? NextResponse.next({ request })
    : intlMiddleware(request);

  response.headers.set("x-pathname", request.nextUrl.pathname);

  /**
   * Keeps the session cookies fresh before Server Components render.
   *
   * The matcher below is wider than the locale rules need, because the account
   * and the dashboard are exactly where a stale session matters — and they are
   * what the old matcher excluded. The regex above keeps next-intl off them.
   */
  await updateSession({
    requestCookies: request.cookies,
    responseCookies: response.cookies,
  });

  return response;
}

export const config = {
  matcher: ["/((?!_next|opengraph-image|twitter-image|.*\\..*).*)"],
};
