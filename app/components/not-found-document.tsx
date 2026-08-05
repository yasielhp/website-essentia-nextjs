"use client";

import { useSyncExternalStore } from "react";
import { fontVariables } from "@lib/fonts";
import { NotFoundContent } from "@components/not-found-content";

/**
 * The whole document for the global 404.
 *
 * A URL that matches no route is served outside every route group, so reading
 * the locale on the server would mean a dynamic API in a file Next includes in
 * the tree of the entire application — the same trade that once made all 38
 * public pages dynamic. It is read on the client instead, from the path first
 * and the cookie second, the way `global-error.tsx` already does it.
 */
function readIsEs() {
  return (
    /^\/es(?:\/|$)/.test(window.location.pathname) ||
    /(?:^|;\s*)NEXT_LOCALE=es(?:;|$)/.test(document.cookie)
  );
}

export function NotFoundDocument() {
  const isEs = useSyncExternalStore(
    () => () => {},
    readIsEs,
    () => false,
  );

  return (
    <html lang={isEs ? "es" : "en"} className={fontVariables}>
      <body className="bg-petroleum-700">
        <NotFoundContent isEs={isEs} />
      </body>
    </html>
  );
}
