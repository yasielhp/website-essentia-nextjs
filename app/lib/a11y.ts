import type { KeyboardEvent } from "react";

/**
 * Makes a plain element behave like the button it already looks like.
 *
 * Rows across the dashboard carry an `onClick` that navigates somewhere, on a
 * `<div>` with a pointer cursor. A mouse user cannot tell the difference; a
 * keyboard user cannot reach it at all, and a screen reader announces nothing,
 * because a `div` with a click handler is still a `div`.
 *
 * Spread it in place of the handler:
 *
 *     <div {...activatable(() => push(href))} className="…">
 *
 * Pass `undefined` for a row that is not clickable right now — a past day in
 * the calendar — and it contributes nothing, so the element keeps out of the
 * tab order rather than offering a stop that does nothing.
 *
 * `preventDefault` on Space is what stops the page scrolling underneath, which
 * is the browser's default for that key.
 */
export function activatable(action: (() => void) | undefined) {
  if (!action) return {};

  return {
    role: "button" as const,
    tabIndex: 0,
    onClick: action,
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "Enter" || event.key === " ") {
        event.preventDefault();
        action();
      }
    },
  };
}
