"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

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

// ─── Tipos ────────────────────────────────────────────────────

type TierVariant = "dark" | "light";

type Tier = {
  variant: TierVariant;
  badge: string;
  name: string;
  description: string;
  features: string[];
  ctaLabel: string;
  ctaVariant: "outline-white" | "solid";
};

// ─── Datos de tiers ───────────────────────────────────────────

const tiers: Tier[] = [
  {
    variant: "dark",
    badge: "Entry",
    name: "Essential",
    description:
      "Full access to all wellness facilities, group sessions, and community events.",
    features: ["Wellness facilities", "Group sessions", "Community events"],
    ctaLabel: "Learn more",
    ctaVariant: "outline-white",
  },
  {
    variant: "light",
    badge: "Most popular",
    name: "Premium",
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
    variant: "dark",
    badge: "Exclusive",
    name: "Founder",
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
    ctaVariant: "outline-white",
  },
];

// ─── Card ─────────────────────────────────────────────────────

function TierCard({ tier }: { tier: Tier }) {
  const isDark = tier.variant === "dark";

  return (
    <article
      className={[
        "rounded-2xl p-7 flex flex-col gap-4",
        isDark
          ? "bg-petroleum-800 border border-petroleum-500"
          : "bg-sand-100 border-2 border-sand-200",
      ].join(" ")}
    >
      <span
        className={[
          "self-start text-xs px-3 py-1 rounded-full",
          isDark
            ? "bg-petroleum-500/30 text-sand-500"
            : "bg-petroleum-700 text-sand-50",
        ].join(" ")}
      >
        {tier.badge}
      </span>

      <h3
        className={[
          "font-display text-2xl mt-4",
          isDark ? "text-sand-50" : "text-petroleum-700",
        ].join(" ")}
      >
        {tier.name}
      </h3>

      <p
        className={[
          "text-sm mt-2 leading-relaxed",
          isDark ? "text-sand-500" : "text-petroleum-400",
        ].join(" ")}
      >
        {tier.description}
      </p>

      <ul className="flex flex-col gap-2 mt-2">
        {tier.features.map((feature) => (
          <li
            key={feature}
            className={[
              "flex items-start gap-2 text-sm",
              isDark ? "text-sand-500" : "text-petroleum-500",
            ].join(" ")}
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
          href="/community/memberships"
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
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const header = headerRef.current;
    const cards = cardsRef.current;
    if (!section || !header || !cards) return;

    const ctx = gsap.context(() => {
      gsap.from(header, {
        opacity: 0,
        y: 30,
        duration: 0.6,
        ease: "power3.out",
        scrollTrigger: {
          trigger: header,
          start: "top 80%",
        },
      });

      gsap.from(Array.from(cards.children), {
        opacity: 0,
        y: 50,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.15,
        scrollTrigger: {
          trigger: cards,
          start: "top 70%",
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-petroleum-700 w-full py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-5">
        {/* ─── Header ── */}
        <div ref={headerRef} className="flex flex-col items-center text-center">
          <span className="text-xs tracking-widest uppercase text-sand-600">
            Membership
          </span>
          <h2 className="font-display text-3xl md:text-5xl text-sand-50 text-center mt-3 text-balance">
            Choose your
            <br />
            level of access.
          </h2>
          <p className="text-sand-500 text-center mt-4 max-w-lg mx-auto leading-relaxed">
            Every tier includes full access to the Essentia space — what changes
            is depth, priority, and belonging.
          </p>
        </div>

        {/* ─── Cards ── */}
        <div
          ref={cardsRef}
          className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-5"
        >
          {tiers.map((tier) => (
            <TierCard key={tier.name} tier={tier} />
          ))}
        </div>
      </div>
    </section>
  );
}
