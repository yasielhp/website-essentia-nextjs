"use client";

import { useCallback, useEffect, useId, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

/**
 * A small tooltip that shows on hover AND on keyboard focus (a `title` shows on
 * neither for a keyboard, and not at all on a touch screen), and is never cut
 * off by the `overflow` of the bar it sits in: the bubble is drawn on the page
 * itself, at a fixed place beside the element, and keeps inside the window.
 *
 * `useTooltip(label)` gives the element what it needs (`attach`, the events, and
 * `aria-describedby` while the bubble is up) and the bubble to render next to
 * it. The element should carry its own accessible name: the bubble is the
 * sighted way to read it, not the only one. Escape, a scroll or a resize close it.
 */

const BUBBLE_MAX_PX = 256;
const MARGIN_PX = 8;
const GAP_PX = 8;

export type TipRect = {
  left: number;
  right: number;
  top: number;
  bottom: number;
};

/**
 * Where the bubble goes, over plain numbers: centred over the element, above
 * it, or below it when there is no room above, and with its middle kept far
 * enough from the sides of the window for the widest bubble to stay inside.
 */
export function tooltipPlacement(
  rect: TipRect,
  viewportWidth: number,
): { x: number; y: number; below: boolean } {
  const half = BUBBLE_MAX_PX / 2 + MARGIN_PX;
  const middle = (rect.left + rect.right) / 2;
  const x = Math.min(
    Math.max(middle, half),
    Math.max(half, viewportWidth - half),
  );
  const below = rect.top < 48;
  return {
    x,
    y: below ? rect.bottom + GAP_PX : rect.top - GAP_PX,
    below,
  };
}

/** The bubble itself, drawn where `useTooltip` says. */
export function TooltipBubble({
  id,
  rect,
  viewportWidth,
  children,
}: {
  id: string;
  rect: TipRect;
  viewportWidth: number;
  children: ReactNode;
}) {
  const { x, y, below } = tooltipPlacement(rect, viewportWidth);
  return (
    <div
      id={id}
      role="tooltip"
      style={{
        position: "fixed",
        left: x,
        top: y,
        transform: below ? "translateX(-50%)" : "translate(-50%, -100%)",
        maxWidth: BUBBLE_MAX_PX,
      }}
      className="bg-petroleum-700 pointer-events-none z-[70] w-max rounded-lg px-2.5 py-1.5 text-center text-xs leading-snug font-medium text-white shadow-lg"
    >
      {children}
    </div>
  );
}

export function useTooltip(label: string) {
  const id = useId();
  const [element, setElement] = useState<HTMLElement | null>(null);
  const [rect, setRect] = useState<TipRect | null>(null);

  const show = useCallback(() => {
    if (element) setRect(element.getBoundingClientRect());
  }, [element]);
  const hide = useCallback(() => setRect(null), []);

  useEffect(() => {
    if (!rect) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setRect(null);
    };
    const close = () => setRect(null);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, true);
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
    };
  }, [rect]);

  const bubble =
    rect && typeof document !== "undefined"
      ? createPortal(
          <TooltipBubble id={id} rect={rect} viewportWidth={window.innerWidth}>
            {label}
          </TooltipBubble>,
          document.body,
        )
      : null;

  return {
    /** Spread on the element; `attach` is a callback ref so the caller can keep its own. */
    props: {
      "aria-describedby": rect ? id : undefined,
      onMouseEnter: show,
      onMouseLeave: hide,
      onFocus: show,
      onBlur: hide,
    },
    attach: setElement,
    bubble,
  };
}
