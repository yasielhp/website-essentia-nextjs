"use client";

import { useEffect, type RefObject } from "react";

/**
 * For an inline confirmation that replaces the buttons it was asked from (an
 * `alertdialog`): when it appears, focus goes to its first button (the safe
 * answer, listed first), and when it goes away focus goes back to where the
 * question came from.
 *
 * Use it in a component that exists only while the question is open. The
 * element to return to is looked up when the confirmation closes, because the
 * button that asked is usually unmounted while it is open and a new one stands
 * in its place; `returnTo` finds that one.
 */
export function useDialogFocus(
  ref: RefObject<HTMLElement | null>,
  returnTo: () => HTMLElement | null,
) {
  useEffect(() => {
    ref.current?.querySelector<HTMLElement>("button:not([disabled])")?.focus();
    return () => {
      returnTo()?.focus();
    };
    // Once per time the confirmation is open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
