"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Logo from "./logo";
import Link from "next/link";
import { MobileMenu } from "./mobile-menu";

const itemsLeft = [
  {
    title: "Services",
    slug: "/services",
  },
  {
    title: "Treatments",
    slug: "/treatments",
  },
  {
    title: "Store",
    slug: "/store",
  },
];

const itemsRight = [
  {
    title: "About",
    slug: "/about",
  },

  {
    title: "Contact",
    slug: "/contact",
  },
];

export const Header = () => {
  const pathname = usePathname();
  const isHome = pathname === "/";
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      const headerY = 80;
      const sections = document.querySelectorAll<HTMLElement>(
        "[data-header-theme]",
      );

      for (let i = sections.length - 1; i >= 0; i--) {
        const rect = sections[i].getBoundingClientRect();
        if (rect.top <= headerY && rect.bottom > headerY) {
          setIsDark(sections[i].dataset.headerTheme === "dark");
          return;
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  return (
    <header className="fixed top-10 z-50 mx-auto flex w-full justify-center">
      <div
        className={`max-w-10xl xs:flex hidden w-full items-center justify-between px-14 py-8 uppercase transition-colors duration-500 ${
          isDark ? "text-primary" : "text-white"
        }`}
      >
        <div className="xs:gap-6 flex items-center justify-center gap-0">
          {itemsLeft.map((item) => {
            return (
              <Link
                key={item.slug}
                href={item.slug}
                className="py-2 font-medium transition-transform hover:scale-105"
              >
                {item.title}
              </Link>
            );
          })}
        </div>
        {isHome ? (
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
            className="mx-6 w-40 cursor-pointer transition-transform hover:scale-105"
          >
            <Logo />
          </button>
        ) : (
          <Link
            href="/"
            className="mx-6 block w-40 transition-transform hover:scale-105"
          >
            <Logo />
          </Link>
        )}
        <div className="xs:gap-6 flex items-center justify-center gap-0">
          {itemsRight.map((item) => {
            return (
              <Link
                key={item.slug}
                href={item.slug}
                className="py-2 font-medium transition-transform hover:scale-105"
              >
                {item.title}
              </Link>
            );
          })}
          <Link
            href="/booking"
            className="bg-primary hover:shadow-hover rounded-md px-4 py-2 font-medium text-white transition-all hover:scale-105"
          >
            Book Now
          </Link>
        </div>
      </div>
      <MobileMenu isDark={isDark} />
    </header>
  );
};
