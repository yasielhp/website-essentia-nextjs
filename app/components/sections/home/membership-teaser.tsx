"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

// ─── Types ────────────────────────────────────────────────────

type Tier = {
  badge: string;
  name: string;
  price: number;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "outline" | "solid";
};

// ─── Datos de tiers ───────────────────────────────────────────

const tiers: Tier[] = [
  {
    badge: "Entry",
    name: "Essential",
    price: 199,
    description:
      "Full access to all wellness facilities, group sessions, and community events.",
    features: ["Wellness facilities", "Group sessions", "Community events"],
    ctaLabel: "Learn more",
    ctaVariant: "outline",
  },
  {
    badge: "Most popular",
    name: "Premium",
    price: 349,
    description:
      "All Essential benefits plus priority booking, personalized protocols, and medical consultations.",
    features: [
      "Everything in Essential",
      "Priority booking",
      "Personalized protocols",
      "Medical consultations",
      "Guest privileges (2/month)",
    ],
    ctaLabel: "Explore Premium",
    ctaVariant: "solid",
  },
  {
    badge: "Exclusive",
    name: "Founder",
    price: 699,
    description:
      "Full ecosystem access with a dedicated health advisor, unlimited guest privileges, and founding member status.",
    features: [
      "Everything in Premium",
      "Dedicated health advisor",
      "Unlimited guest privileges",
      "Founding member events",
      "Priority treatment access",
    ],
    ctaLabel: "Learn more",
    ctaVariant: "outline",
  },
];

// ─── Checkmark ────────────────────────────────────────────────

function Checkmark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={14}
      height={14}
      fill="none"
      aria-hidden="true"
      className={`mt-0.5 shrink-0 ${className ?? ""}`}
    >
      <path
        d="M3 8l3.5 3.5 6.5-7"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

// ─── Card ─────────────────────────────────────────────────────

function TierCard({ tier }: { tier: Tier }) {
  const tierId = tier.name.toLowerCase();

  return (
    <article className="bg-sand-100 flex flex-col gap-4 rounded-2xl p-7">
      <span className="bg-petroleum-100 text-petroleum-500 self-start rounded-full px-3 py-1 text-xs tracking-wider uppercase">
        {tier.badge}
      </span>

      <div>
        <h3 className="font-display text-petroleum-700 text-2xl">
          {tier.name}
        </h3>
        <div className="mt-3 flex items-end gap-1">
          <span className="font-display text-petroleum-700 text-3xl leading-none">
            €{tier.price}
          </span>
          <span className="text-petroleum-400 mb-0.5 text-xs">/month</span>
        </div>
      </div>

      <p className="text-petroleum-500 text-sm leading-relaxed">
        {tier.description}
      </p>

      <ul className="flex flex-col gap-2">
        {tier.features.map((feature) => (
          <li
            key={feature}
            className="text-petroleum-600 flex items-start gap-2 text-sm"
          >
            <Checkmark />
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
          {tier.ctaLabel}
        </Button>
      </div>
    </article>
  );
}

// ─── MembershipTeaser ─────────────────────────────────────────

export default function MembershipTeaser() {
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
              Choose your
              <br />
              level of access.
            </h2>
            <p className="text-sand-500 mx-auto max-w-lg text-center leading-relaxed">
              Every tier includes full access to the Essentia space: what
              changes is depth, priority, and belonging.
            </p>
          </div>

          {/* ─── Cards ── */}
          <div
            ref={cardsRef}
            className="mt-10 grid grid-cols-1 gap-5 md:grid-cols-3"
          >
            {tiers.map((tier) => (
              <TierCard key={tier.name} tier={tier} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
