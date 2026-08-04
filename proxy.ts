import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";
import { NextRequest } from "next/server";

const intlMiddleware = createMiddleware(routing);

export function proxy(request: NextRequest) {
  const response = intlMiddleware(request);
  response.headers.set("x-pathname", request.nextUrl.pathname);
  return response;
}

export const config = {
  // `account` is excluded for the same reason `dashboard` is: both live outside
  // the `[locale]` tree, so they have no entry in `routing.pathnames`. The
  // next-intl middleware could not resolve them and answered 404 — which is
  // what every "My account" link in the header, and the redirect after signing
  // in, had been getting.
  matcher: [
    "/((?!dashboard|account|api|_next|opengraph-image|twitter-image|.*\\..*).*)",
  ],
};
