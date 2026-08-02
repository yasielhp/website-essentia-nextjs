"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── TheSpace ──────────────────────────────────────────────────

export default function TheSpace() {
  const t = useTranslations("home.theSpace");
  const tStats = useTranslations("home.theSpace.stats");
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const inner = innerRef.current;
    if (!inner) return;

    const ctx = gsap.context(() => {
      const headerEls = inner.querySelectorAll("[data-space-header]");
      const imgEls = inner.querySelectorAll("[data-space-img]");
      const statEls = inner.querySelectorAll("[data-space-stat]");

      gsap.from(headerEls, {
        opacity: 0,
        y: 40,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: inner, start: "top 80%", once: true },
      });

      gsap.from(imgEls, {
        opacity: 0,
        scale: 0.97,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: inner, start: "top 80%", once: true },
      });

      gsap.from(statEls, {
        opacity: 0,
        y: 20,
        stagger: 0.08,
        duration: 0.6,
        ease: "power3.out",
        scrollTrigger: { trigger: inner, start: "top 75%", once: true },
      });

      // Ken Burns — continuous pan on each image
      const imgInners = inner.querySelectorAll<HTMLElement>(
        "[data-space-img] img",
      );
      const pans = [
        { x: "3%", y: "2%" },
        { x: "-4%", y: "3%" },
        { x: "4%", y: "-3%" },
      ];
      const durations = [14, 11, 13];

      imgInners.forEach((img, i) => {
        gsap.set(img, { scale: 1.1 });
        gsap.to(img, {
          x: pans[i % pans.length]!.x,
          y: pans[i % pans.length]!.y,
          duration: durations[i % durations.length],
          ease: "sine.inOut",
          repeat: -1,
          yoyo: true,
        });
      });
    }, inner);

    return () => ctx.revert();
  }, []);

  return (
    <section className="bg-petroleum-700">
      <div className="overflow-hidden">
        <div
          ref={innerRef}
          className="mx-auto flex max-w-4xl flex-col gap-8 px-5 pt-24 pb-16 md:gap-10 md:pt-36 md:pb-16"
        >
          {/* ─── Header editorial ── */}
          <div>
            <h2
              data-space-header
              className="font-display text-sand-50 mt-3 max-w-lg text-3xl md:text-5xl"
            >
              {t("headline")}
            </h2>

            <p
              data-space-header
              className="text-sand-500 mt-5 max-w-2xl leading-relaxed"
            >
              {t("body")}
            </p>

            <Button
              data-space-header
              variant="outline-white"
              size="md"
              href="/about"
              className="mt-8 w-full md:w-auto"
            >
              {t("cta")}
            </Button>
          </div>

          {/* ─── Image grid ── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Main image */}
            <div
              data-space-img
              className="relative h-48 overflow-hidden rounded-2xl md:h-64"
            >
              <Image
                src="/images/home/bento-img-3-v3.webp"
                alt="Essentia wellness space in Tenerife"
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
              />
            </div>

            {/* Right column — desktop only */}
            <div className="hidden flex-col gap-4 md:flex">
              <div
                data-space-img
                className="relative h-30 overflow-hidden rounded-2xl"
              >
                <Image
                  src="/images/home/bento-img-1-v3.webp"
                  alt="Essentia treatment room"
                  fill
                  sizes="50vw"
                  className="object-cover"
                />
              </div>

              <div
                data-space-img
                className="relative h-30 overflow-hidden rounded-2xl"
              >
                <Image
                  src="/images/home/bento-img-5-v3.webp"
                  alt="Essentia outdoor area Tenerife"
                  fill
                  sizes="50vw"
                  className="object-cover object-center"
                />
              </div>
            </div>
          </div>

          {/* ─── Stats bar ── */}
          <div className="border-petroleum-500 grid grid-cols-3 border-t pt-6">
            <div
              data-space-stat
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="font-display text-sand-50 text-2xl md:text-3xl">
                {tStats("totalSpace.value")}
              </span>
              <span className="text-sand-600 text-xs tracking-wider uppercase">
                {tStats("totalSpace.label")}
              </span>
            </div>

            <div
              data-space-stat
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="font-display text-sand-50 text-2xl md:text-3xl">
                {tStats("floors.value")}
              </span>
              <span className="text-sand-600 text-xs tracking-wider uppercase">
                {tStats("floors.label")}
              </span>
            </div>

            <div
              data-space-stat
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="font-display text-sand-50 text-xl">
                {tStats("location.value")}
              </span>
              <span className="text-sand-600 text-xs tracking-wider uppercase">
                {tStats("location.label")}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
