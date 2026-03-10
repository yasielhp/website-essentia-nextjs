"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import Logo from "./logo";
import gsap from "gsap";

const navItems = [
  { title: "Services", slug: "/services" },
  { title: "Treatments", slug: "/treatments" },
  { title: "Store", slug: "/store" },
  { title: "About", slug: "/about" },
  { title: "Contact", slug: "/contact" },
];

export function MobileMenu({ isDark }: { isDark: boolean }) {
  const [isOpen, setIsOpen] = useState(false);
  const navRef = useRef<HTMLElement>(null);
  const tweenRef = useRef<gsap.core.Timeline | null>(null);

  const animateMenu = useCallback((open: boolean) => {
    if (tweenRef.current) tweenRef.current.kill();

    const items = navRef.current?.children;
    if (!items) return;

    if (open) {
      gsap.set(items, { opacity: 0, y: 12 });
      tweenRef.current = gsap.timeline();
      tweenRef.current.to(items, {
        opacity: 1,
        y: 0,
        stagger: 0.05,
        duration: 0.35,
        ease: "power3.out",
      });
    } else {
      tweenRef.current = gsap.timeline();
      tweenRef.current.to(items, {
        opacity: 0,
        y: 12,
        stagger: 0.03,
        duration: 0.2,
        ease: "power2.in",
      });
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !isOpen;
    setIsOpen(next);
    requestAnimationFrame(() => animateMenu(next));
  }, [isOpen, animateMenu]);

  const close = useCallback(() => {
    setIsOpen(false);
    animateMenu(false);
  }, [animateMenu]);

  const lineColor = isOpen || isDark ? "bg-primary" : "bg-white";

  return (
    <div className="flex w-full items-center justify-between px-10 md:hidden">
      <Link
        href="/"
        className={`relative z-50 block w-36 transition-colors duration-500 ${
          isOpen || isDark ? "text-primary" : "text-white"
        }`}
      >
        <Logo />
      </Link>
      <button
        onClick={toggle}
        className="relative z-50 flex h-8 w-8 flex-col items-center justify-center gap-1.5"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <span
          className={`block h-0.5 w-6 origin-center transition-all duration-300 ease-in-out ${
            isOpen ? `${lineColor} translate-y-1 rotate-45` : lineColor
          }`}
        />
        <span
          className={`block h-0.5 w-6 transition-all duration-300 ease-in-out ${
            isOpen ? "opacity-0" : lineColor
          }`}
        />
        <span
          className={`block h-0.5 w-6 origin-center transition-all duration-300 ease-in-out ${
            isOpen ? `${lineColor} -translate-y-3 -rotate-45` : lineColor
          }`}
        />
      </button>

      <div
        className={`bg-background fixed inset-0 z-40 flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <nav
          ref={navRef}
          className="flex w-full flex-col items-center gap-8 px-6"
        >
          {navItems.map((item) => (
            <Link
              key={item.slug}
              href={item.slug}
              onClick={close}
              className="text-primary text-3xl font-medium tracking-wide uppercase"
              style={{ opacity: 0, transform: "translateY(12px)" }}
            >
              {item.title}
            </Link>
          ))}
          <Link
            href="/booking"
            onClick={close}
            className="bg-primary mt-4 w-full rounded-md px-8 py-3 text-center text-lg font-medium tracking-wide text-white uppercase"
            style={{ opacity: 0, transform: "translateY(12px)" }}
          >
            Book Now
          </Link>
        </nav>
      </div>
    </div>
  );
}
