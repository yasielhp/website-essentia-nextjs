"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import { IconCheck } from "@/components/ui/icons";

gsap.registerPlugin(ScrollTrigger);

// ─── Types ────────────────────────────────────────────────────

type TierKey = "essential" | "premium" | "founder";

type Tier = {
  key: TierKey;
  price: number;
  featureCount: number;
  ctaVariant: "outline" | "solid";
};

// ─── Datos de tiers ───────────────────────────────────────────

const tiers: Tier[] = [
  {
    key: "essential",
    price: 199,
    featureCount: 3,
    ctaVariant: "outline",
  },
  {
    key: "premium",
    price: 349,
    featureCount: 5,
    ctaVariant: "solid",
  },
  {
    key: "founder",
    price: 699,
    featureCount: 5,
    ctaVariant: "outline",
  },
];

// ─── Card ─────────────────────────────────────────────────────

function TierCard({ tier }: { tier: Tier }) {
  const t = useTranslations(`home.membershipTeaser.tiers.${tier.key}`);
  const tCommon = useTranslations("home.membershipTeaser");
  const name = t("name");
  const tierId = name.toLowerCase();
  const features = Array.from({ length: tier.featureCount }, (_, i) =>
    t(`features.${i}`),
  );

  return (
    <article className="bg-sand-100 flex flex-col gap-4 rounded-2xl p-7">
      <span className="bg-petroleum-100 text-petroleum-500 self-start rounded-full px-3 py-1 text-xs tracking-wider uppercase">
        {t("badge")}
      </span>

      <div>
        <h3 className="font-display text-petroleum-700 text-2xl">{name}</h3>
        <div className="mt-3 flex items-end gap-1">
          <span className="font-display text-petroleum-700 text-3xl leading-none">
            €{tier.price}
          </span>
          <span className="text-petroleum-400 mb-0.5 text-xs">
            {tCommon("perMonth")}
          </span>
        </div>
      </div>

      <p className="text-petroleum-500 text-sm leading-relaxed">
        {t("description")}
      </p>

      <ul className="flex flex-col gap-2">
        {features.map((feature) => (
          <li
            key={feature}
            className="text-petroleum-500 flex items-start gap-2 text-sm"
          >
            <IconCheck className="mt-0.5 shrink-0" />
            {feature}
          </li>
        ))}
      </ul>

      <div className="mt-auto pt-4">
        <Button
          variant={tier.ctaVariant}
          size="md"
          href={`/community/memberships?tier=${tierId}#tiers`}
          className="w-full md:w-auto"
        >
          {t("cta")}
        </Button>
      </div>
    </article>
  );
}

// ─── MembershipTeaser ─────────────────────────────────────────

export default function MembershipTeaser() {
  const t = useTranslations("home.membershipTeaser");
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const header = headerRef.current;
    const cards = cardsRef.current;
    if (!section || !inner || !header || !cards) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const cardEls = Array.from(cards.children);

      mm.add("(min-width: 768px)", () => {
        gsap.set(header, { opacity: 0, y: 30 });
        gsap.set(cardEls, { opacity: 0, y: 50 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(header, { opacity: 1, y: 0, duration: 0.25, ease: "power3.out" });
        tl.to(
          cardEls,
          {
            opacity: 1,
            y: 0,
            stagger: 0.15,
            duration: 0.4,
            ease: "power3.out",
          },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(header, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: header, start: "top 85%", once: true },
        });
        cardEls.forEach((card) => {
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
    <section ref={sectionRef} className="bg-petroleum-700 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-32 pb-16 md:h-full md:justify-center md:pt-36 md:pb-16">
          {/* ─── Header ── */}
          <div
            ref={headerRef}
            className="flex flex-col items-center gap-5 text-center"
          >
            <h2 className="font-display text-sand-50 mt-3 text-center text-3xl text-balance md:text-5xl">
              {t("headline")}
              <br />
              {t("headline2")}
            </h2>
            <p className="text-sand-500 mx-auto max-w-lg text-center leading-relaxed">
              {t("subheadline")}
            </p>
          </div>

          {/* ─── Cards ── */}
          <div
            ref={cardsRef}
            className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3"
          >
            {tiers.map((tier) => (
              <TierCard key={tier.key} tier={tier} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
