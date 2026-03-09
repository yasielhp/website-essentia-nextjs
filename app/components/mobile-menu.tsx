"use client";

import { useState } from "react";
import Link from "next/link";
import Logo from "./logo";

const navItems = [
  { title: "Services", slug: "/services" },
  { title: "Treatments", slug: "/treatments" },
  { title: "Store", slug: "/store" },
  { title: "About", slug: "/about" },
  { title: "Contact", slug: "/contact" },
];

export function MobileMenu() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="flex w-full items-center justify-between px-10 md:hidden">
      <Link
        href="/"
        className={`relative z-50 block w-36 ${isOpen ? "text-primary" : "text-white"}`}
      >
        <Logo />
      </Link>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative z-50 flex h-8 w-8 flex-col items-center justify-center gap-1.5"
        aria-label={isOpen ? "Close menu" : "Open menu"}
        aria-expanded={isOpen}
      >
        <span
          className={`block h-0.5 w-6 origin-center transition-transform duration-300 ease-in-out ${isOpen ? "bg-primary translate-y-1 rotate-45" : "bg-white"}`}
        />
        <span
          className={`block h-0.5 w-6 transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-0" : "bg-white"}`}
        />
        <span
          className={`block h-0.5 w-6 origin-center transition-transform duration-300 ease-in-out ${isOpen ? "bg-primary -translate-y-3 -rotate-45" : "bg-white"}`}
        />
      </button>

      <div
        className={`bg-background fixed inset-0 z-40 flex flex-col items-center justify-center transition-opacity duration-300 ease-in-out ${isOpen ? "opacity-100" : "pointer-events-none opacity-0"}`}
      >
        <nav className="flex w-full flex-col items-center gap-8 px-6">
          {navItems.map((item, i) => (
            <Link
              key={item.slug}
              href={item.slug}
              onClick={() => setIsOpen(false)}
              className="text-primary text-3xl font-medium tracking-wide uppercase transition-opacity duration-300"
              style={{
                transitionDelay: isOpen ? `${i * 50}ms` : "0ms",
                opacity: isOpen ? 1 : 0,
                transform: isOpen ? "translateY(0)" : "translateY(12px)",
                transitionProperty: "opacity, transform",
              }}
            >
              {item.title}
            </Link>
          ))}
          <Link
            href="/book"
            onClick={() => setIsOpen(false)}
            className="bg-primary mt-4 w-full rounded-md px-8 py-3 text-center text-lg font-medium tracking-wide text-white uppercase transition-opacity duration-300"
            style={{
              transitionDelay: isOpen ? `${navItems.length * 50}ms` : "0ms",
              opacity: isOpen ? 1 : 0,
              transform: isOpen ? "translateY(0)" : "translateY(12px)",
              transitionProperty: "opacity, transform",
            }}
          >
            Book Now
          </Link>
        </nav>
      </div>
    </div>
  );
}
