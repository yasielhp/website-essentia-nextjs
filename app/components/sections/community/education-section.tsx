"use client";

import { useRef, useEffect, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Calendar, Clock, Lock, Globe, Tag, Users } from "lucide-react";
import { useTranslations, useLocale } from "next-intl";
import { Button } from "@components/ui/button";
import { insforge } from "@/lib/insforge";
import { useAuth } from "@/components/auth-provider";

gsap.registerPlugin(ScrollTrigger);

type AccessType = "members_only" | "open" | "paid" | "paid_members_free";

type NextSession = {
  id: string;
  title: string;
  description: string | null;
  date: string | null;
  duration_minutes: number | null;
  location: string | null;
  max_participants: number | null;
  speaker: string | null;
  speaker_role: string | null;
  price_cents: number | null;
  access: AccessType;
  image_url: string | null;
};

function formatSessionDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(locale === "es" ? "es-ES" : "en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Atlantic/Canary",
  });
}

function formatSessionTimeRange(
  iso: string | null,
  durationMinutes: number | null,
  locale: string,
): string {
  if (!iso) return "—";
  const intl = locale === "es" ? "es-ES" : "en-GB";
  const start = new Date(iso);
  const startStr = start.toLocaleTimeString(intl, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Atlantic/Canary",
  });
  if (durationMinutes) {
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const endStr = end.toLocaleTimeString(intl, {
      hour: "2-digit",
      minute: "2-digit",
      timeZone: "Atlantic/Canary",
    });
    return `${startStr} – ${endStr}`;
  }
  return startStr;
}

type AccessLabels = {
  membersOnly: string;
  free: string;
  paid: string;
  paidMembersFree: string;
  paidMembersFreeSuffix: string;
};

function formatAccess(
  access: AccessType,
  priceCents: number | null,
  labels: AccessLabels,
): string {
  switch (access) {
    case "members_only":
      return labels.membersOnly;
    case "open":
      return labels.free;
    case "paid":
      return priceCents != null
        ? `€${(priceCents / 100).toFixed(2)}`
        : labels.paid;
    case "paid_members_free":
      return priceCents != null
        ? `€${(priceCents / 100).toFixed(2)} · ${labels.paidMembersFreeSuffix}`
        : labels.paidMembersFree;
  }
}

function accessIcon(access: AccessType) {
  switch (access) {
    case "members_only":
      return Lock;
    case "open":
      return Globe;
    default:
      return Tag;
  }
}

const pillarKeys = ["experts", "practical", "dialogue"] as const;
const pillarNumbers: Record<(typeof pillarKeys)[number], string> = {
  experts: "I",
  practical: "II",
  dialogue: "III",
};

// ─── Hero ─────────────────────────────────────────────────────

function EducationHero() {
  const t = useTranslations("community.education.hero");
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
        src="/images/menu/education-programs.webp"
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
            "linear-gradient(to bottom, rgb(9 33 33 / 0.6), rgb(9 33 33 / 0.78))",
        }}
      />
      <div ref={heroRef} className="relative mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          {t("title")}
          <br />
          {t("titleBreak")}
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          {t("body")}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            onClick={() => {
              const el = document.getElementById("next-session");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("reveal-next-session"));
              }
            }}
          >
            {t("ctaNext")}
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

// ─── Next session ─────────────────────────────────────────────

function NextSessionSection({
  session,
  isMember,
}: {
  session: NextSession | null;
  isMember: boolean;
}) {
  const t = useTranslations("community.education.next");
  const locale = useLocale();
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  const AccessIcon = session ? accessIcon(session.access) : Lock;

  const accessLabels: AccessLabels = {
    membersOnly: t("membersOnly"),
    free: t("free"),
    paid: t("paid"),
    paidMembersFree: t("paidMembersFree"),
    paidMembersFreeSuffix: t("paidMembersFreeSuffix"),
  };

  const sessionDetails = session
    ? [
        { icon: Calendar, value: formatSessionDate(session.date, locale) },
        {
          icon: Clock,
          value: formatSessionTimeRange(
            session.date,
            session.duration_minutes,
            locale,
          ),
        },
        {
          icon: AccessIcon,
          value: formatAccess(
            session.access,
            session.price_cents,
            accessLabels,
          ),
        },
        {
          icon: Users,
          value: session.max_participants
            ? t("limitedTo", { seats: session.max_participants })
            : t("openSeats"),
        },
      ]
    : [];

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
    window.addEventListener("reveal-next-session", revealAll);

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
      window.removeEventListener("reveal-next-session", revealAll);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="next-session"
      className="bg-sand-50 md:h-[280vh]"
    >
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
                <Image
                  src={
                    session?.image_url ?? "/images/menu/education-programs.webp"
                  }
                  alt={session?.title ?? t("altDefault")}
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col justify-between gap-6 p-8 md:p-10">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                      {session ? session.title : t("comingSoon")}
                    </h3>
                  </div>
                  <p className="text-petroleum-500 text-sm leading-relaxed">
                    {session?.description ?? t("comingSoonBody")}
                  </p>
                </div>

                {session && (
                  <div className="border-sand-500 grid grid-cols-2 gap-4 border-t pt-6">
                    {sessionDetails.map(({ icon: Icon, value }) => (
                      <div key={value} className="flex items-start gap-2">
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
                )}

                {session?.access === "members_only" && !isMember ? (
                  <div className="flex flex-col gap-2">
                    <Button
                      variant="solid"
                      size="md"
                      href="/community/memberships"
                      className="w-full md:w-auto md:self-start"
                    >
                      {t("ctaJoin")}
                    </Button>
                    <p className="text-petroleum-400 text-xs">
                      {t("membersOnlyNote")}
                    </p>
                  </div>
                ) : (
                  <Button
                    variant="solid"
                    size="md"
                    href={
                      session
                        ? `/community/education-programs/register?id=${session.id}`
                        : "/community/education-programs/register"
                    }
                    className="w-full md:w-auto md:self-start"
                  >
                    {t("ctaReserve")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Format ───────────────────────────────────────────────────

function FormatSection() {
  const t = useTranslations("community.education.format");
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
              {pillarKeys.map((k) => (
                <div key={k}>
                  <span className="font-display text-petroleum-500 text-5xl">
                    {pillarNumbers[k]}
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
  const t = useTranslations("community.education.ctaBlock");
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

export default function EducationSection() {
  const [nextSession, setNextSession] = useState<NextSession | null>(null);
  const { user } = useAuth();

  const isMember =
    user?.role === "member" || user?.role === "admin" || user?.role === "staff";

  useEffect(() => {
    const today = new Date().toISOString();
    void insforge.database
      .from("education_sessions")
      .select(
        "id, title, description, date, duration_minutes, location, max_participants, speaker, speaker_role, price_cents, access, image_url",
      )
      .gte("date", today)
      .order("date", { ascending: true })
      .limit(1)
      .then(({ data }) => {
        if (data && data.length > 0) setNextSession(data[0] as NextSession);
      });
  }, []);

  return (
    <>
      <EducationHero />
      <NextSessionSection session={nextSession} isMember={isMember} />
      <FormatSection />
      <CtaSection />
    </>
  );
}
