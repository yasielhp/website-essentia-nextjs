"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslations, useLocale } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export type NextRace = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
};

function formatRaceDate(dateStr: string, locale: string) {
  return new Intl.DateTimeFormat(locale === "es" ? "es-ES" : "en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(dateStr + "T00:00:00"));
}

// ─── CommunitySection ─────────────────────────────────────────

export default function CommunitySection({ race }: { race: NextRace | null }) {
  const t = useTranslations("home.community");
  const tRun = useTranslations("home.community.runningClub");
  const tNextRace = useTranslations("home.community.nextRace");
  const locale = useLocale();

  const headerRef = useRef<HTMLDivElement>(null);
  const cardLeftRef = useRef<HTMLDivElement>(null);
  const cardRightRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const cardLeft = cardLeftRef.current;
    const cardRight = cardRightRef.current;
    if (!header || !cardLeft || !cardRight) return;

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

      gsap.from(cardRight, {
        opacity: 0,
        y: 50,
        duration: 0.7,
        delay: 0.1,
        ease: "power3.out",
        scrollTrigger: { trigger: cardRight, start: "top 85%", once: true },
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
                  href="/experiences/running-club"
                  className="text-sand-300 mt-3 inline-block text-sm transition-colors duration-150 hover:text-white"
                >
                  {tRun("cta")}
                </Link>
              </div>
            </div>

            {/* ─── Right Card — Next Race ────────────────────── */}
            <div
              ref={cardRightRef}
              className="relative h-64 min-h-60 overflow-hidden rounded-2xl md:h-full"
            >
              {race ? (
                <>
                  <Image
                    src="/images/community/running-club-hero.webp"
                    alt={race.title}
                    fill
                    sizes="(max-width: 767px) 100vw, 50vw"
                    className="object-cover"
                  />
                  <div className="from-petroleum-900/90 via-petroleum-800/40 absolute inset-0 bg-gradient-to-t to-transparent" />
                  <div className="absolute bottom-0 left-0 p-6 text-white">
                    <span className="mb-3 inline-block rounded-full bg-white/10 px-3 py-1 text-xs tracking-wider uppercase backdrop-blur-sm">
                      {tNextRace("badge")}
                    </span>
                    <h3 className="font-display text-xl text-white">
                      {race.title}
                    </h3>
                    <p className="mt-1 text-sm text-white/70">
                      {race.date ? formatRaceDate(race.date, locale) : null}
                      {race.location ? ` · ${race.location}` : null}
                    </p>
                    {race.distance_km ? (
                      <p className="mt-0.5 text-sm text-white/60">
                        {race.distance_km} km
                      </p>
                    ) : null}
                    <Link
                      href={`/experiences/running-club`}
                      className="text-sand-300 mt-3 inline-block text-sm transition-colors duration-150 hover:text-white"
                    >
                      {tNextRace("cta")}
                    </Link>
                  </div>
                </>
              ) : (
                <div className="bg-petroleum-700 flex h-full flex-col items-center justify-center p-8 text-center">
                  <span className="text-sand-600 text-xs tracking-wider uppercase">
                    {tNextRace("badge")}
                  </span>
                  <p className="font-display text-sand-50 mt-3 text-xl">
                    {tNextRace("noRaceTitle")}
                  </p>
                  <p className="text-sand-500 mt-2 text-sm">
                    {tNextRace("noRaceBody")}
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
