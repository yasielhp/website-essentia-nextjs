"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Shows `placeholder` until the place it stands in comes near the screen, and
 * only then mounts `children` (which is where they start to read what they
 * show). For a card low in a long page that nobody may reach: opening the page
 * then costs nothing for it, and a card that asks a third party (the WhatsApp
 * templates ask Meta) does not ask every time the page is opened. The
 * placeholder should be the content's own loading shape, so nothing jumps when
 * it takes over. Without `IntersectionObserver` it loads at once.
 */
export function LoadWhenVisible({
  placeholder,
  children,
  rootMargin = "400px",
}: {
  placeholder: ReactNode;
  children: ReactNode;
  /** How far before it is on screen it starts loading. */
  rootMargin?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      const timer = setTimeout(() => setVisible(true), 0);
      return () => clearTimeout(timer);
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setVisible(true);
          observer.disconnect();
        }
      },
      { rootMargin },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [rootMargin]);

  return <div ref={ref}>{visible ? children : placeholder}</div>;
}
