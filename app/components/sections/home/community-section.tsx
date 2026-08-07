"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── CommunitySection ─────────────────────────────────────────

export default function CommunitySection() {
  const t = useTranslations("home.community");
  const tExp = useTranslations("home.community.experiences");
  const tEdu = useTranslations("home.community.educationPrograms");
  const tRun = useTranslations("home.community.runningClub");

  const headerRef = useRef<HTMLDivElement>(null);
  const cardLeftRef = useRef<HTMLDivElement>(null);
  const cardsRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const cardLeft = cardLeftRef.current;
    const cardsRight = cardsRightRef.current;
    if (!header || !cardLeft || !cardsRight) return;

    const ctx = gsap.context(() => {
      gsap.from(Array.from(header.children), {
        opacity: 0,
        y: 30,
        stagger: 0.08,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: header, start: "top 85%", once: true },
      });

      gsap.from(cardLeft, {
        opacity: 0,
        y: 50,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: cardLeft, start: "top 85%", once: true },
      });

      const rightCards = cardsRight.querySelectorAll(":scope > div");
      gsap.from(rightCards, {
        opacity: 0,
        y: 50,
        stagger: 0.1,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: cardsRight, start: "top 85%", once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section className="bg-sand-100">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
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
            {/* ─── Left Card — Experiences ───────────────────── */}
            <div
              ref={cardLeftRef}
              className="relative h-64 min-h-60 overflow-hidden rounded-2xl md:h-full"
            >
              <Image
                src="/images/community/hero.webp"
                alt="Experiencias Essentia Tenerife"
                fill
                sizes="(max-width: 767px) 100vw, 50vw"
                className="object-cover"
              />
              <div className="from-petroleum-900/90 via-petroleum-800/40 absolute inset-0 bg-linear-to-t to-transparent" />
              <div className="absolute bottom-0 left-0 p-6 text-white">
                <h3 className="font-display text-xl text-white">
                  {tExp("headline")}
                </h3>
                <Button
                  variant="outline-white"
                  size="sm"
                  href="/experiences"
                  className="mt-4 w-full md:w-auto"
                >
                  {tExp("cta")}
                </Button>
              </div>
            </div>

            {/* ─── Right Column — Education + Running Club ───── */}
            <div ref={cardsRightRef} className="flex flex-col gap-4">
              {/* ─── Education Programs Card ───────────────── */}
              <div className="bg-petroleum-700 rounded-2xl p-5">
                <h3 className="font-display text-sand-50 text-xl">
                  {tEdu("headline")}
                </h3>
                <p className="text-sand-500 mt-2 text-sm leading-relaxed">
                  {tEdu("description")}
                </p>
                <Button
                  variant="outline-white"
                  size="sm"
                  href="/experiences/education-programs"
                  className="mt-4 w-full md:w-auto"
                >
                  {tEdu("cta")}
                </Button>
              </div>

              {/* ─── Running Club Card ─────────────────────── */}
              <div className="bg-sand-50 rounded-2xl p-5">
                <h3 className="font-display text-petroleum-700 text-xl">
                  {tRun("headline")}
                </h3>
                <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                  {tRun("description")}
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  href="/experiences/running-club"
                  className="mt-4 w-full md:w-auto"
                >
                  {tRun("cta")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
