"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── AboutTeaser ──────────────────────────────────────────────
// Closes the home page by pointing at the about page: the visitor has just
// read what Essentia does, and this is where they find out who is behind it.

export default function AboutTeaser() {
  const t = useTranslations("home.about");
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const ctx = gsap.context(() => {
      // The whole column animates as one block. Staggering the children left
      // the button — whose label mounts its own letter animation — stuck at
      // opacity 0 when the trigger fired.
      gsap.from(inner.querySelector("[data-about-text]"), {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: inner, start: "top 85%", once: true },
      });

      gsap.from(inner.querySelector("[data-about-img]"), {
        opacity: 0,
        scale: 0.97,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: inner, start: "top 85%", once: true },
      });
    }, inner);

    return () => ctx.revert();
  }, []);

  return (
    <section className="bg-sand-50">
      <div className="overflow-hidden">
        <div
          ref={innerRef}
          className="mx-auto grid max-w-4xl items-center gap-8 px-5 pt-16 pb-24 md:grid-cols-2 md:gap-10 md:py-20"
        >
          <div
            data-about-img
            className="relative h-56 overflow-hidden rounded-2xl md:h-72"
          >
            <Image
              src="/images/home/about-teaser-1600x1120.webp"
              alt={t("imageAlt")}
              fill
              sizes="(max-width: 767px) 100vw, 50vw"
              className="object-cover"
            />
          </div>

          <div data-about-text>
            <span className="text-petroleum-400 block text-xs tracking-wider uppercase">
              {t("eyebrow")}
            </span>

            <h2 className="font-display text-petroleum-700 mt-3 text-3xl md:text-4xl">
              {t("headline")}
            </h2>

            <p className="text-petroleum-400 mt-4 leading-relaxed">
              {t("body")}
            </p>

            <Button
              variant="outline"
              size="md"
              href="/about"
              className="mt-6 w-full md:w-auto"
            >
              {t("cta")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
