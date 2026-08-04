"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Positions a portalled dropdown against its trigger.
 *
 * A portal escapes the stacking contexts that otherwise clip a dropdown inside
 * a scrolling card, but it also means the panel no longer follows the trigger —
 * hence the fixed coordinates, recomputed on scroll.
 *
 * It flips upward when there is not enough room below, and caps the height at
 * whichever is smaller: the space available, so the last option never ends up
 * under the fold, or DROPDOWN_MAX_H, so a long list scrolls inside the panel
 * instead of running the full height of the window.
 */

const DROPDOWN_MAX_H = 320;

export function useDropdownPortal(isOpen: boolean) {
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const [dropdownStyle, setDropdownStyle] = useState<React.CSSProperties>({});

  useEffect(() => {
    if (!isOpen) return;

    const updatePosition = () => {
      if (!triggerRef.current) return;
      const rect = triggerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom - 8;
      const openUpward =
        spaceBelow < DROPDOWN_MAX_H && rect.top > DROPDOWN_MAX_H;

      setDropdownStyle({
        position: "fixed",
        ...(openUpward
          ? { bottom: window.innerHeight - rect.top + 8 }
          : { top: rect.bottom + 8 }),
        left: rect.left,
        width: rect.width,
        maxHeight: Math.min(
          DROPDOWN_MAX_H,
          openUpward ? rect.top - 16 : spaceBelow,
        ),
      });
    };

    updatePosition();
    window.addEventListener("scroll", updatePosition, true);
    window.addEventListener("resize", updatePosition);
    return () => {
      window.removeEventListener("scroll", updatePosition, true);
      window.removeEventListener("resize", updatePosition);
    };
  }, [isOpen]);

  return { triggerRef, dropdownRef, dropdownStyle };
}

/** Below this width the dropdown becomes a full-screen sheet. */
export function isMobileViewport(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(max-width: 767px)").matches
  );
}
