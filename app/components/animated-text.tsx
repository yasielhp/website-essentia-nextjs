"use client";

import { useRef, Children, type ReactNode } from "react";
import Link from "next/link";
import gsap from "gsap";
import type { ComponentPropsWithoutRef } from "react";

// ─── SplitText ────────────────────────────────────────────────
// Divide el texto en spans individuales para la animación por caracteres.
// Mantiene accesibilidad con sr-only + aria-hidden.

function splitChars(text: string) {
  return text.split("").map((char, i) => (
    <span key={i} data-char>
      {char === " " ? "\u00A0" : char}
    </span>
  ));
}

export function SplitText({ children }: { children: ReactNode }) {
  // String puro — caso más común (botones, items del dropdown)
  if (typeof children === "string") {
    return (
      <>
        <span className="sr-only">{children}</span>
        <span className="inline-flex" aria-hidden="true">
          {splitChars(children)}
        </span>
      </>
    );
  }

  // Children mixtos (texto + iconos) — nav del header
  const childArray = Children.toArray(children);
  const hasStrings = childArray.some((c) => typeof c === "string");
  if (!hasStrings) return <>{children}</>;

  // Texto plano para lectores de pantalla
  const srText = childArray.filter((c) => typeof c === "string").join("");

  return (
    <>
      <span className="sr-only">{srText}</span>
      {/* contents: no genera caja, los hijos participan en el flex del padre */}
      <span style={{ display: "contents" }} aria-hidden="true">
        {childArray.map((child, i) =>
          typeof child === "string" ? (
            <span key={i} className="inline-flex">
              {splitChars(child)}
            </span>
          ) : (
            child
          ),
        )}
      </span>
    </>
  );
}

// ─── useTextAnimation ─────────────────────────────────────────
// Hook reutilizable: devuelve ref + handler para animar [data-char] al hover.

export function useTextAnimation<T extends HTMLElement>() {
  const ref = useRef<T>(null);

  const handleMouseEnter = () => {
    if (!ref.current) return;
    const chars = ref.current.querySelectorAll("[data-char]");
    if (!chars.length) return;
    gsap.fromTo(
      chars,
      { y: 4, opacity: 0.4 },
      { y: 0, opacity: 1, stagger: 0.025, duration: 0.3, ease: "power2.out" },
    );
  };

  return { ref, handleMouseEnter };
}

// ─── AnimatedLink ─────────────────────────────────────────────
// Link de Next.js con animación de texto por caracteres al hover.

type AnimatedLinkProps = ComponentPropsWithoutRef<typeof Link> & {
  children: ReactNode;
};

export function AnimatedLink({
  children,
  onMouseEnter,
  className,
  ...props
}: AnimatedLinkProps) {
  const { ref, handleMouseEnter } = useTextAnimation<HTMLAnchorElement>();

  return (
    <Link
      ref={ref}
      className={className}
      onMouseEnter={(e) => {
        handleMouseEnter();
        onMouseEnter?.(e);
      }}
      {...props}
    >
      <SplitText>{children}</SplitText>
    </Link>
  );
}
