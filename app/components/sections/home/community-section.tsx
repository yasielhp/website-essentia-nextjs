"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── CommunitySection ─────────────────────────────────────────

export default function CommunitySection() {
  const t = useTranslations("home.community");
  const tRun = useTranslations("home.community.runningClub");
  const tEdu = useTranslations("home.community.educationPrograms");
  const tEvents = useTranslations("home.community.events");
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
        tl.to(headerChildren, {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: 0.25,
          ease: "power3.out",
        });
        tl.to(
          cardLeft,
          { opacity: 1, y: 0, duration: 0.3, ease: "power3.out" },
          "-=0.05",
        );
        tl.to(
          rightCards,
          {
            opacity: 1,
            y: 0,
            stagger: 0.12,
            duration: 0.3,
            ease: "power3.out",
          },
          "-=0.2",
        );
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(headerChildren, {
          opacity: 0,
          y: 30,
          stagger: 0.08,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: header, start: "top 85%", once: true },
        });
        gsap.fromTo(
          cardLeft,
          { opacity: 0, y: 50, scale: 0.96 },
          {
            opacity: 1,
            y: 0,
            scale: 1,
            ease: "none",
            scrollTrigger: {
              trigger: cardLeft,
              start: "top 88%",
              end: "top 35%",
              scrub: 0.7,
            },
          },
        );
        rightCards.forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 50, scale: 0.96 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                start: "top 88%",
                end: "top 35%",
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
    <section ref={sectionRef} className="bg-sand-100 md:h-[260vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          {/* ─── Header ───────────────────────────────────────── */}
          <div ref={headerRef} className="mb-10 text-center md:text-left">
            <h2 className="font-display text-petroleum-700 mt-3 text-3xl md:max-w-lg md:text-5xl">
              {t("headline")}
              <br />
              {t("headline2")}
            </h2>
          </div>

          {/* ─── Main Grid ────────────────────────────────────── */}
          <div className="grid gap-5 md:grid-cols-2">
            {/* ─── Left Card — Running Club ──────────────────── */}
            <div
              ref={cardLeftRef}
              className="relative h-64 min-h-60 overflow-hidden rounded-2xl md:h-full"
            >
              <Image
                src="/images/home/bento-img-4.webp"
                alt="Running club members on a coastal route in Costa Adeje"
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="from-petroleum-900/90 via-petroleum-800/40 absolute inset-0 bg-gradient-to-t to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <span className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs tracking-wider uppercase backdrop-blur-sm">
                  {tRun("badge")}
                </span>
                <h3 className="font-display text-xl text-white">
                  {tRun("headline")}
                </h3>
                <p className="mt-1 text-sm text-white/70">
                  {tRun("description")}
                </p>
                <Link
                  href="/community/running-club"
                  className="text-sand-300 mt-3 inline-block text-sm transition-colors duration-150 hover:text-white"
                >
                  {tRun("cta")}
                </Link>
              </div>
            </div>

            {/* ─── Right Column — Education + Events ────────── */}
            <div ref={cardsRightRef} className="flex flex-col gap-4">
              {/* ─── Education Programs Card ───────────────── */}
              <div className="bg-petroleum-700 rounded-2xl p-5">
                <p className="text-sand-600 text-xs tracking-wider uppercase">
                  {tEdu("badge")}
                </p>
                <h3 className="font-display text-sand-50 mt-2 text-xl">
                  {tEdu("headline")}
                </h3>
                <p className="text-sand-500 mt-2 text-sm leading-relaxed">
                  {tEdu("description")}
                </p>
                <Button
                  variant="outline-white"
                  size="sm"
                  href="/community/education-programs"
                  className="mt-4 w-full md:w-auto"
                >
                  {tEdu("cta")}
                </Button>
              </div>

              {/* ─── Events Card ───────────────────────────── */}
              <div className="bg-sand-50 rounded-2xl p-5">
                <p className="text-petroleum-400 text-xs tracking-wider uppercase">
                  {tEvents("badge")}
                </p>
                <h3 className="font-display text-petroleum-700 mt-2 text-xl">
                  {tEvents("headline")}
                </h3>
                <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                  {tEvents("description")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  href="/community"
                  className="mt-4 w-full md:w-auto"
                >
                  {tEvents("cta")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
