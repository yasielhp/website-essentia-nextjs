"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── TheSpace ──────────────────────────────────────────────────

export default function TheSpace() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const ctx = gsap.context(() => {
      // ─── Header animation ──
      const headerEls = section.querySelectorAll("[data-space-header]");
      gsap.set(headerEls, { opacity: 0, y: 40 });
      gsap.to(headerEls, {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 75%",
          once: true,
        },
      });

      // ─── Images animation ──
      const imgEls = section.querySelectorAll("[data-space-img]");
      gsap.set(imgEls, { opacity: 0, scale: 0.97, transformOrigin: "center" });
      gsap.to(imgEls, {
        opacity: 1,
        scale: 1,
        stagger: 0.12,
        duration: 0.8,
        ease: "power2.out",
        scrollTrigger: {
          trigger: section.querySelector("[data-space-grid]"),
          start: "top 80%",
          once: true,
        },
      });

      // ─── Stats animation ──
      const statEls = section.querySelectorAll("[data-space-stat]");
      gsap.set(statEls, { opacity: 0, y: 20 });
      gsap.to(statEls, {
        opacity: 1,
        y: 0,
        stagger: 0.1,
        duration: 0.6,
        ease: "power2.out",
        scrollTrigger: {
          trigger: section.querySelector("[data-space-stats]"),
          start: "top 85%",
          once: true,
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      className="bg-petroleum-700 py-20 md:py-32"
    >
      <div className="mx-auto max-w-4xl px-5">
        {/* ─── Header editorial ── */}
        <span
          data-space-header
          className="text-sand-600 text-xs tracking-widest uppercase"
        >
          The Space
        </span>

        <h2
          data-space-header
          className="font-display text-sand-50 mt-3 max-w-lg text-3xl md:text-5xl"
        >
          Built for those
          <br />
          who invest in themselves.
        </h2>

        <p
          data-space-header
          className="text-sand-500 mt-5 max-w-md leading-relaxed"
        >
          Perched on the cliffs of Costa Adeje in Tenerife, Essentia is a place
          where architecture, light, and purpose align — designed to slow you
          down in all the right ways.
        </p>

        <Button
          data-space-header
          variant="outline-white"
          size="md"
          href="/about"
          className="mt-8"
        >
          Discover Essentia
        </Button>
      </div>

      {/* ─── Image grid ── */}
      <div
        data-space-grid
        className="mx-auto mt-12 max-w-4xl px-5 grid grid-cols-1 md:grid-cols-2 gap-4"
      >
        {/* Main image */}
        <div
          data-space-img
          className="relative h-72 md:h-96 rounded-2xl overflow-hidden"
        >
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-3.webp"
            alt="Essentia wellness space in Tenerife"
            fill
            sizes="(max-width: 767px) 100vw, 50vw"
            className="object-cover"
          />
        </div>

        {/* Right column — desktop only */}
        <div className="hidden md:flex flex-col gap-4">
          <div
            data-space-img
            className="relative h-44 rounded-2xl overflow-hidden"
          >
            <Image
              src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-1.webp"
              alt="Essentia treatment room"
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>

          <div
            data-space-img
            className="relative h-44 rounded-2xl overflow-hidden"
          >
            <Image
              src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-5.webp"
              alt="Essentia outdoor area Tenerife"
              fill
              sizes="50vw"
              className="object-cover"
            />
          </div>
        </div>
      </div>

      {/* ─── Stats bar ── */}
      <div
        data-space-stats
        className="mx-auto mt-10 max-w-4xl px-5 grid grid-cols-3 border-t border-petroleum-500 pt-8"
      >
        <div data-space-stat className="flex flex-col items-center text-center gap-1">
          <span className="font-display text-sand-50 text-2xl md:text-3xl">
            1,200 m²
          </span>
          <span className="text-sand-600 text-xs uppercase tracking-wider">
            Total space
          </span>
        </div>

        <div data-space-stat className="flex flex-col items-center text-center gap-1">
          <span className="font-display text-sand-50 text-2xl md:text-3xl">
            3
          </span>
          <span className="text-sand-600 text-xs uppercase tracking-wider">
            Floors of wellness
          </span>
        </div>

        <div data-space-stat className="flex flex-col items-center text-center gap-1">
          <span className="font-display text-sand-50 text-xl">
            Tenerife
          </span>
          <span className="text-sand-600 text-xs uppercase tracking-wider">
            Costa Adeje, Spain
          </span>
        </div>
      </div>
    </section>
  );
}
