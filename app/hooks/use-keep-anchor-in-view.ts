"use client";

import { useEffect } from "react";

/**
 * Whether an element the address points at (`#id`) has been pushed away from
 * where an anchor puts it, `top` being where it is now and `margin` its scroll
 * margin. Pure.
 */
export function anchorDrifted(
  top: number,
  margin: number,
  tolerance = 24,
): boolean {
  return Math.abs(top - margin) > tolerance;
}

/**
 * The browser scrolls to `#id` once, when the page is first drawn. On a page
 * whose cards load their content afterwards, what is ABOVE the target grows and
 * pushes it down: the person arrives near the card, not at it. For a few
 * seconds, this puts it back, and stops at the first sign the person is in
 * charge (wheel, touch, key, click). It does nothing when the address names
 * another element.
 */
export function useKeepAnchorInView(id: string, forMs = 3000) {
  useEffect(() => {
    if (window.location.hash !== `#${id}`) return;
    let stopped = false;
    const stop = () => {
      stopped = true;
    };
    const events = ["wheel", "touchmove", "keydown", "pointerdown"] as const;
    for (const name of events) {
      window.addEventListener(name, stop, { passive: true, once: true });
    }
    const started = Date.now();
    const timer = setInterval(() => {
      if (stopped || Date.now() - started > forMs) {
        clearInterval(timer);
        return;
      }
      const el = document.getElementById(id);
      if (!el) return;
      const margin = parseFloat(getComputedStyle(el).scrollMarginTop) || 0;
      if (anchorDrifted(el.getBoundingClientRect().top, margin)) {
        el.scrollIntoView({ block: "start" });
      }
    }, 250);
    return () => {
      clearInterval(timer);
      for (const name of events) window.removeEventListener(name, stop);
    };
  }, [id, forMs]);
}
