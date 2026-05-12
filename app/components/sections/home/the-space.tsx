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
  const innerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    if (!section || !inner) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const headerEls = inner.querySelectorAll("[data-space-header]");
      const imgEls = inner.querySelectorAll("[data-space-img]");
      const statEls = inner.querySelectorAll("[data-space-stat]");

      mm.add("(min-width: 768px)", () => {
        gsap.set(headerEls, { opacity: 0, y: 40 });
        gsap.set(imgEls, { opacity: 0, scale: 0.97 });
        gsap.set(statEls, { opacity: 0, y: 20 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(headerEls, {
          opacity: 1,
          y: 0,
          stagger: 0.08,
          duration: 0.3,
          ease: "power3.out",
        });
        tl.to(
          imgEls,
          {
            opacity: 1,
            scale: 1,
            stagger: 0.1,
            duration: 0.35,
            ease: "power2.out",
            transformOrigin: "center",
          },
          "-=0.1",
        );
        tl.to(
          statEls,
          {
            opacity: 1,
            y: 0,
            stagger: 0.08,
            duration: 0.25,
            ease: "power2.out",
          },
          "-=0.1",
        );
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(Array.from(headerEls), {
          opacity: 0,
          y: 30,
          stagger: 0.08,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: inner, start: "top 80%", once: true },
        });
        const mainImg = imgEls[0];
        if (mainImg) {
          gsap.fromTo(
            mainImg,
            { opacity: 0, scale: 0.97 },
            {
              opacity: 1,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: mainImg,
                start: "top 88%",
                end: "top 30%",
                scrub: 0.7,
              },
            },
          );
        }
        Array.from(statEls).forEach((stat) => {
          gsap.fromTo(
            stat,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: stat,
                start: "top 90%",
                end: "top 50%",
                scrub: 0.7,
              },
            },
          );
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-petroleum-700 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col gap-8 px-5 pt-24 pb-16 md:h-full md:justify-center md:gap-10 md:pt-36 md:pb-16">
          {/* ─── Header editorial ── */}
          <div>
            <h2
              data-space-header
              className="font-display text-sand-50 mt-3 max-w-lg text-3xl md:text-5xl"
            >
              Built for those who invest in themselves.
            </h2>

            <p
              data-space-header
              className="text-sand-500 mt-5 max-w-2xl leading-relaxed"
            >
              Perched on the cliffs of Costa Adeje in Tenerife, Essentia is a
              place where architecture, light, and purpose align, designed to
              slow you down in all the right ways.
            </p>

            <Button
              data-space-header
              variant="outline-white"
              size="md"
              href="/about"
              className="mt-8 w-full md:w-auto"
            >
              Discover Essentia
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
                src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-3.webp"
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
                  src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-1.webp"
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
          <div className="border-petroleum-500 grid grid-cols-3 border-t pt-6">
            <div
              data-space-stat
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="font-display text-sand-50 text-2xl md:text-3xl">
                1,200 m²
              </span>
              <span className="text-sand-600 text-xs tracking-wider uppercase">
                Total space
              </span>
            </div>

            <div
              data-space-stat
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="font-display text-sand-50 text-2xl md:text-3xl">
                3
              </span>
              <span className="text-sand-600 text-xs tracking-wider uppercase">
                Floors of wellness
              </span>
            </div>

            <div
              data-space-stat
              className="flex flex-col items-center gap-1 text-center"
            >
              <span className="font-display text-sand-50 text-xl">
                Tenerife
              </span>
              <span className="text-sand-600 text-xs tracking-wider uppercase">
                Costa Adeje, Spain
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
