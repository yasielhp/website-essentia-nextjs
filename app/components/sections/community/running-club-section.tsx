"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { MapPin, Route, Lock, Globe } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@components/ui/button";
import { insforge } from "@/lib/insforge";
import { IconRunner } from "@/components/ui/icons";

gsap.registerPlugin(ScrollTrigger);

type NextRace = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  location: string | null;
  distance_km: number | null;
  max_participants: number | null;
  image_url: string | null;
  access: "members" | "open" | null;
};

function formatRaceDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function formatRaceTime(iso: string | null): string {
  if (!iso) return "";
  const match = iso.match(/[T ](\d{2}:\d{2})/);
  if (!match) return "";
  return match[1] === "00:00" ? "" : match[1];
}

const expectKeys = ["routes", "paced", "community"] as const;
const expectNumbers: Record<(typeof expectKeys)[number], string> = {
  routes: "I",
  paced: "II",
  community: "III",
};

// ─── Hero ─────────────────────────────────────────────────────

function RunningClubHero() {
  const t = useTranslations("community.runningClub.hero");
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (heroRef.current) {
        gsap.from(Array.from(heroRef.current.children), {
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
        src="/images/community/running-club-hero.webp"
        alt={t("imageAlt")}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(9 33 33 / 0.55), rgb(9 33 33 / 0.72))",
        }}
      />
      <div ref={heroRef} className="relative mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          {t("title")}
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          {t("body")}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            onClick={() => {
              const el = document.getElementById("next-run");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("reveal-next-run"));
              }
            }}
          >
            {t("ctaNextRun")}
          </Button>
          <Button
            variant="outline-white"
            size="md"
            href="/community/memberships"
          >
            {t("ctaJoin")}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Next run ─────────────────────────────────────────────────

function NextRunSection({ race }: { race: NextRace | null }) {
  const t = useTranslations("community.runningClub.next");
  const locale = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const raceTime = formatRaceTime(race?.date ?? null);

  const details = [
    {
      id: "distance",
      icon: Route,
      value: race?.distance_km ? `${race.distance_km} km` : t("dash"),
      wide: false,
    },
    {
      id: "access",
      icon: race?.access === "open" ? Globe : Lock,
      value: race?.access === "open" ? t("openToAll") : t("membersOnly"),
      wide: false,
    },
    {
      id: "location",
      icon: MapPin,
      value: race?.location ?? t("dash"),
      wide: true,
    },
  ];

  useEffect(() => {
    const revealAll = () => {
      if (!bodyRef.current) return;
      gsap.to(Array.from(bodyRef.current.children), {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        overwrite: true,
      });
    };
    window.addEventListener("reveal-next-run", revealAll);

    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      const inner = innerRef.current;
      const body = bodyRef.current;
      if (!section || !inner || !body) return;

      const children = Array.from(body.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        gsap.set(children, { opacity: 0, y: 40 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(children[0], {
          opacity: 1,
          y: 0,
          duration: 0.2,
          ease: "power3.out",
        });
        tl.to(
          children[1],
          { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: child,
                start: "top 88%",
                end: "top 35%",
                scrub: 0.7,
              },
            },
          );
        });
      });
    }, sectionRef);

    return () => {
      ctx.revert();
      window.removeEventListener("reveal-next-run", revealAll);
    };
  }, []);

  return (
    <section ref={sectionRef} id="next-run" className="bg-sand-50 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-8">
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("heading")}
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                {t("subheading")}
              </p>
            </div>
            <div className="bg-sand-100 grid grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-2">
              <div className="relative h-56 md:h-auto md:min-h-72">
                {race?.image_url ? (
                  <Image
                    src={race.image_url}
                    alt={race.title || t("altDefault")}
                    fill
                    sizes="(max-width: 767px) 100vw, 50vw"
                    className="object-cover"
                  />
                ) : (
                  <div className="bg-petroleum-700 flex h-full w-full flex-col items-center justify-center gap-4">
                    <IconRunner className="text-petroleum-500 opacity-60" />
                    <span className="text-petroleum-400 text-xs tracking-widest uppercase">
                      {t("noImage")}
                    </span>
                  </div>
                )}
              </div>
              <div className="flex flex-col justify-between gap-6 p-8 md:p-10">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                      {race
                        ? formatRaceDate(race.date, locale)
                        : t("comingSoon")}
                    </h3>
                    {raceTime && (
                      <p className="text-petroleum-400 mt-1 text-sm">
                        {raceTime}
                      </p>
                    )}
                  </div>
                  <p className="text-petroleum-500 text-sm leading-relaxed">
                    {race
                      ? `${race.title}. ${race.description ?? ""}`
                      : t("comingSoonBody")}
                  </p>
                </div>
                <div className="border-sand-500 grid grid-cols-2 gap-4 border-t pt-6">
                  {details.map(({ id, icon: Icon, value, wide }) => (
                    <div
                      key={id}
                      className={`flex items-start gap-2${wide ? "col-span-2" : ""}`}
                    >
                      <Icon
                        className="text-petroleum-400 mt-0.5 shrink-0"
                        size={15}
                      />
                      <p className="text-petroleum-500 text-sm leading-snug">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="solid"
                  size="md"
                  href={
                    race
                      ? `/community/running-club/register?id=${race.id}`
                      : "/community/running-club/register"
                  }
                  className="w-full md:w-auto md:self-start"
                >
                  {t("cta")}
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── What to expect ───────────────────────────────────────────

function ExpectSection() {
  const t = useTranslations("community.runningClub.expect");
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      const inner = innerRef.current;
      const body = bodyRef.current;
      if (!section || !inner || !body) return;

      const children = Array.from(body.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        gsap.set(children, { opacity: 0, y: 40 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(children[0], {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power3.out",
        });
        tl.to(
          children[1],
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: child,
                start: "top 88%",
                end: "top 35%",
                scrub: 0.7,
              },
            },
          );
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-petroleum-700 md:h-[260vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col gap-12 md:gap-16">
            <div className="md:max-w-lg">
              <h2 className="font-display text-sand-50 text-3xl md:text-4xl">
                {t("heading")}
              </h2>
              <p className="text-sand-500 mt-4 leading-relaxed">{t("body")}</p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {expectKeys.map((k) => (
                <div key={k}>
                  <span className="font-display text-petroleum-500 text-5xl">
                    {expectNumbers[k]}
                  </span>
                  <h3 className="text-sand-100 mt-3 text-lg font-medium">
                    {t(`items.${k}.title`)}
                  </h3>
                  <p className="text-sand-500 mt-2 text-sm leading-relaxed">
                    {t(`items.${k}.description`)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────

function CtaSection() {
  const t = useTranslations("community.runningClub.ctaBlock");
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      const inner = innerRef.current;
      const body = bodyRef.current;
      if (!section || !inner || !body) return;

      const children = Array.from(body.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        gsap.set(children, { opacity: 0, y: 40 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(children, {
          opacity: 1,
          y: 0,
          stagger: 0.15,
          duration: 0.35,
          ease: "power3.out",
        });
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: child,
                start: "top 88%",
                end: "top 35%",
                scrub: 0.7,
              },
            },
          );
        });
      });
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-sand-50 md:h-[220vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-16 text-center md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col items-center gap-6">
            <h2 className="font-display text-petroleum-700 text-3xl text-balance md:text-4xl">
              {t("heading")}
            </h2>
            <p className="text-petroleum-400 max-w-md leading-relaxed">
              {t("body")}
            </p>
            <Button variant="solid" size="md" href="/community/memberships">
              {t("cta")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function RunningClubSection() {
  const [nextRace, setNextRace] = useState<NextRace | null>(null);

  useEffect(() => {
    const today = new Date().toISOString().slice(0, 10);
    void insforge.database
      .from("races")
      .select(
        "id, title, description, date, location, distance_km, max_participants, image_url, access",
      )
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setNextRace(data[0] as NextRace);
      });
  }, []);

  return (
    <>
      <RunningClubHero />
      <NextRunSection race={nextRace} />
      <ExpectSection />
      <CtaSection />
    </>
  );
}
