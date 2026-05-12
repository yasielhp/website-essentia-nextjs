"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── CommunitySection ─────────────────────────────────────────

export default function CommunitySection() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardLeftRef = useRef<HTMLDivElement>(null);
  const cardsRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const header = headerRef.current;
    const cardLeft = cardLeftRef.current;
    const cardsRight = cardsRightRef.current;
    if (!section || !inner || !header || !cardLeft || !cardsRight) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const headerChildren = Array.from(header.children);
      const rightCards = Array.from(cardsRight.children);

      mm.add("(min-width: 768px)", () => {
        gsap.set(headerChildren, { opacity: 0, y: 30 });
        gsap.set(cardLeft, { opacity: 0, y: 40 });
        gsap.set(rightCards, { opacity: 0, y: 40 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(headerChildren, { opacity: 1, y: 0, stagger: 0.1, duration: 0.25, ease: "power3.out" });
        tl.to(cardLeft, { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" }, "-=0.05");
        tl.to(rightCards, { opacity: 1, y: 0, stagger: 0.12, duration: 0.3, ease: "power3.out" }, "-=0.2");
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(headerChildren, {
          opacity: 0, y: 20, stagger: 0.08, duration: 0.6, ease: "power3.out",
          scrollTrigger: { trigger: header, start: "top 85%", once: true },
        });
        gsap.from(cardLeft, {
          opacity: 0, y: 30, duration: 0.6, ease: "power3.out",
          scrollTrigger: { trigger: cardLeft, start: "top 80%", once: true },
        });
        gsap.from(rightCards, {
          opacity: 0, y: 30, stagger: 0.1, duration: 0.6, ease: "power3.out",
          scrollTrigger: { trigger: cardsRight, start: "top 80%", once: true },
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-sand-100 md:h-[260vh]">
      <div ref={innerRef} className="md:h-screen overflow-hidden">
        <div className="mx-auto max-w-4xl px-5 flex flex-col pt-24 pb-16 md:h-full md:justify-center md:py-20">
          {/* ─── Header ───────────────────────────────────────── */}
          <div ref={headerRef} className="text-center md:text-left mb-10">
            <p className="text-xs tracking-widest uppercase text-petroleum-400">
              Community
            </p>
            <h2 className="font-display text-3xl md:text-5xl text-petroleum-700 mt-3 md:max-w-lg">
              A life well-lived
              <br />
              is rarely lived alone.
            </h2>
          </div>

          {/* ─── Main Grid ────────────────────────────────────── */}
          <div className="grid md:grid-cols-2 gap-5">
            {/* ─── Left Card — Running Club ──────────────────── */}
            <div
              ref={cardLeftRef}
              className="relative rounded-2xl overflow-hidden h-64 md:h-full min-h-60"
            >
              <Image
                src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-4.webp"
                alt="Running club members on a coastal route in Costa Adeje"
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-petroleum-900/90 via-petroleum-800/40 to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <span className="text-xs uppercase tracking-wider bg-white/10 backdrop-blur-sm px-3 py-1 rounded-full mb-3 inline-block">
                  Running Club
                </span>
                <h3 className="font-display text-xl text-white">
                  Every Saturday morning, 7:30am
                </h3>
                <p className="text-sm text-white/70 mt-1">
                  Curated routes through Costa Adeje — all levels welcome.
                </p>
                <Link
                  href="/community/running-club"
                  className="text-sm text-sand-300 hover:text-white transition-colors duration-150 mt-3 inline-block"
                >
                  Join the run →
                </Link>
              </div>
            </div>

            {/* ─── Right Column — Education + Events ────────── */}
            <div ref={cardsRightRef} className="flex flex-col gap-4">
              {/* ─── Education Programs Card ───────────────── */}
              <div className="bg-petroleum-700 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-sand-600">
                  Programs
                </p>
                <h3 className="font-display text-xl text-sand-50 mt-2">
                  Longevity Masterclass Series
                </h3>
                <p className="text-sand-500 text-sm mt-2 leading-relaxed">
                  Monthly deep-dives with leading researchers, clinicians, and
                  practitioners — open to all members.
                </p>
                <Button
                  variant="outline-white"
                  size="sm"
                  href="/community/education-programs"
                  className="mt-4"
                >
                  View Programs
                </Button>
              </div>

              {/* ─── Events Card ───────────────────────────── */}
              <div className="bg-sand-50 rounded-2xl p-5">
                <p className="text-xs uppercase tracking-wider text-petroleum-400">
                  Events
                </p>
                <h3 className="font-display text-xl text-petroleum-700 mt-2">
                  Member Gatherings
                </h3>
                <p className="text-petroleum-400 text-sm mt-2 leading-relaxed">
                  Private dinners, wellness retreats, and seasonal celebrations —
                  moments that make the club feel like home.
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  href="/community"
                  className="mt-4"
                >
                  Explore Events
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
