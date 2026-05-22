"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const t = useTranslations("wellness.hero");
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (contentRef.current) {
        gsap.from(Array.from(contentRef.current.children), {
          opacity: 0,
          y: 25,
          stagger: 0.12,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.1,
        });
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Image
        src="/images/wellness/hero.webp"
        alt="Essentia Wellness"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(9 33 33 / 0.65), rgb(9 33 33 / 0.75))",
        }}
      />
      <div ref={contentRef} className="relative mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          {t("headlineLine1")}
          <br />
          {t("headlineLine2")}
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          {t("body")}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            onClick={() => {
              const el = document.getElementById("protocols");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("reveal-protocols"));
              }
            }}
          >
            {t("ctaProtocols")}
          </Button>
          <Button variant="outline-white" size="md" href="/contact">
            {t("ctaContact")}
          </Button>
        </div>
      </div>
    </section>
  );
}
