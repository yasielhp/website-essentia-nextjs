"use client";

import { useRef, useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";
import { TierId, VALID_TIERS, tiers, pricing } from "./data";

gsap.registerPlugin(ScrollTrigger);

// ─── Icons ────────────────────────────────────────────────────

function IconCheck({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 16 16"
      width={15}
      height={15}
      fill="none"
      aria-hidden="true"
      className={["mt-0.5 shrink-0", className].filter(Boolean).join(" ")}
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

// ─── TierTabs ────────────────────────────────────────────────

function TierTabs({
  selected,
  onChange,
}: {
  selected: TierId;
  onChange: (id: TierId) => void;
}) {
  return (
    <div className="bg-petroleum-100 inline-flex rounded-full p-1">
      {tiers.map((tier) => (
        <button
          key={tier.id}
          onClick={() => onChange(tier.id)}
          className={[
            "rounded-full px-5 py-2 text-sm font-medium transition-all duration-200",
            selected === tier.id
              ? "bg-petroleum-700 text-sand-50 shadow-sm"
              : "text-petroleum-500 hover:text-petroleum-700",
          ].join(" ")}
        >
          {tier.name}
        </button>
      ))}
    </div>
  );
}

// ─── TierDisplay ─────────────────────────────────────────────

function TierDisplay({
  tier,
  displayRef,
}: {
  tier: (typeof tiers)[number];
  displayRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div
      ref={displayRef}
      className="bg-sand-100 mx-auto rounded-3xl p-8 md:max-w-2xl md:p-12"
    >
      {/* ── Top row ── */}
      <div className="flex flex-col gap-10 md:flex-row md:items-stretch md:gap-0">
        {/* Left: name + price (+ description + button on mobile only) */}
        <div className="flex flex-col md:w-1/2 md:pr-12">
          <span className="bg-petroleum-100 text-petroleum-500 self-start rounded-full px-3 py-1 text-xs tracking-wider uppercase">
            {tier.badge}
          </span>

          <h3 className="font-display text-petroleum-700 mt-4 text-5xl md:text-6xl">
            {tier.name}
          </h3>
          <p className="text-petroleum-400 mt-1 text-xs tracking-widest uppercase">
            {tier.tagline}
          </p>

          <div className="mt-7 flex items-end gap-1.5">
            <span className="font-display text-petroleum-700 text-5xl leading-none">
              €{pricing[tier.id]}
            </span>
            <span className="text-petroleum-400 mb-1 text-sm">/month</span>
          </div>

          {/* Mobile-only: description + button */}
          <p className="text-petroleum-500 mt-5 text-sm leading-relaxed md:hidden">
            {tier.description}
          </p>
          <div className="mt-auto pt-7 md:hidden">
            <Button variant="solid" size="md" href="#" className="w-full">
              Become a member
            </Button>
          </div>
        </div>

        {/* Right: features */}
        <div className="border-sand-500 flex flex-col border-t pt-8 md:w-1/2 md:border-t-0 md:border-l md:pt-0 md:pl-12">
          <ul className="flex flex-col gap-3.5 md:min-h-[224px]">
            {tier.features.map((feature) => (
              <li
                key={feature}
                className="text-petroleum-600 flex items-start gap-3 text-sm"
              >
                <IconCheck />
                {feature}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* ── Desktop-only bottom: description + button full width ── */}
      <div className="hidden pt-8 md:block">
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {tier.description}
        </p>
        <div className="mt-6">
          <Button
            variant="solid"
            size="md"
            href="#"
            className="w-full md:w-auto"
          >
            Become a member
          </Button>
        </div>
      </div>
    </div>
  );
}

// ─── TierSelector ─────────────────────────────────────────────

function TierSelectorInner() {
  const { get } = useSearchParams();
  const paramValue = get("tier") as TierId | null;
  const initialTier: TierId =
    paramValue && VALID_TIERS.includes(paramValue) ? paramValue : "essential";
  const hasTierParam = useRef(false);

  const [selectedTier, setSelectedTier] = useState<TierId>(initialTier);
  const selectedTierRef = useRef<TierId>(initialTier);

  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const displayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const urlParam = new URLSearchParams(window.location.search).get("tier");
    hasTierParam.current =
      !!urlParam && VALID_TIERS.includes(urlParam as TierId);

    // Skip entrance animation when arriving via ?tier=X or direct #tiers hash
    const skipEntrance =
      hasTierParam.current || window.location.hash === "#tiers";

    if (hasTierParam.current) {
      const el = document.getElementById("tiers");
      if (el) {
        setTimeout(() => {
          const top = el.getBoundingClientRect().top + window.scrollY;
          window.scrollTo({ top, behavior: "smooth" });
        }, 80);
      }
    }

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
    window.addEventListener("reveal-tiers", revealAll);

    const ctx = gsap.context(() => {
      if (!sectionRef.current || !innerRef.current || !bodyRef.current) return;

      const section = sectionRef.current;
      const inner = innerRef.current;
      const children = Array.from(bodyRef.current.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        if (!skipEntrance) gsap.set(children, { opacity: 0, y: 40 });
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
          { opacity: 1, y: 0, duration: 0.2, ease: "power3.out" },
          "-=0.05",
        );
        tl.to(
          children[2],
          { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        if (skipEntrance) return;
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
    });

    return () => {
      ctx.revert();
      window.removeEventListener("reveal-tiers", revealAll);
    };
  }, []);

  // Animate card on tier change (skip initial mount)
  useEffect(() => {
    const prev = selectedTierRef.current;
    selectedTierRef.current = selectedTier;
    if (prev === selectedTier) return;
    if (displayRef.current) {
      gsap.fromTo(
        displayRef.current,
        { opacity: 0, y: 10 },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "power2.out",
          overwrite: true,
        },
      );
    }
  }, [selectedTier]);

  const activeTier = tiers.find((t) => t.id === selectedTier)!;

  return (
    <section ref={sectionRef} id="tiers" className="bg-sand-50 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col gap-8">
            <div className="text-center">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                Choose your membership.
              </h2>
              <p className="text-petroleum-400 mx-auto mt-4 max-w-lg leading-relaxed">
                Select a tier to see what&apos;s included.
              </p>
            </div>

            <div className="flex justify-center">
              <TierTabs selected={selectedTier} onChange={setSelectedTier} />
            </div>

            <TierDisplay tier={activeTier} displayRef={displayRef} />
          </div>
        </div>
      </div>
    </section>
  );
}

export default function TierSelector() {
  return (
    <Suspense fallback={null}>
      <TierSelectorInner />
    </Suspense>
  );
}
