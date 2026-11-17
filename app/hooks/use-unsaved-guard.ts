"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { shouldGuardClick } from "@/lib/messages/unsaved-guard";

/**
 * Asks before unsaved changes are lost to a navigation, as far as a page of the
 * App Router can:
 *
 * - closing the tab, reloading or typing another address: the browser's own
 *   `beforeunload` question;
 * - a click on any link that stays in the app (this page's "back", the sidebar,
 *   the breadcrumbs): stopped before the router sees it, and `pending` holds
 *   where it was going so the page can ask in its own words;
 * - NOT the browser's back and forward buttons, nor a navigation that code
 *   starts. The router offers no way to cancel those, and a workaround that
 *   rewrites history is fragile, so they are left alone.
 */
export function useUnsavedGuard(dirty: boolean) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);

  useEffect(() => {
    if (!dirty) return;

    function onBeforeUnload(event: BeforeUnloadEvent) {
      event.preventDefault();
      // Older browsers read this; newer ones ignore the text.
      event.returnValue = "";
    }

    function onClick(event: MouseEvent) {
      const anchor = (event.target as Element | null)?.closest?.("a[href]");
      if (!(anchor instanceof HTMLAnchorElement)) return;
      const decision = shouldGuardClick({
        href: anchor.getAttribute("href"),
        origin: window.location.origin,
        currentPath: window.location.pathname,
        button: event.button,
        ctrlKey: event.ctrlKey,
        metaKey: event.metaKey,
        shiftKey: event.shiftKey,
        altKey: event.altKey,
        target: anchor.getAttribute("target"),
        download: anchor.hasAttribute("download"),
        defaultPrevented: event.defaultPrevented,
      });
      if (!decision.guard) return;
      event.preventDefault();
      event.stopPropagation();
      setPending(decision.to);
    }

    window.addEventListener("beforeunload", onBeforeUnload);
    // In the capture phase, so it runs before the router's own link handler.
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [dirty]);

  const stay = useCallback(() => setPending(null), []);
  const leave = useCallback(() => {
    const to = pending;
    setPending(null);
    if (to) router.push(to);
  }, [pending, router]);

  // Nothing to ask once nothing is unsaved.
  return { pending: dirty ? pending : null, stay, leave };
}
