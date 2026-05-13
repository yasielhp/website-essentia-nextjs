"use client";

import { useRef, useEffect, useState, useCallback } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ─── Data ──────────────────────────────────────────────────────

const testimonials = [
  // Group 1
  {
    quote:
      "Essentia changed how I think about time. Not just living longer — living better, right now.",
    name: "Marcus V.",
    age: "Age 47",
    initials: "MV",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
  {
    quote:
      "The combination of medical protocols and the community here is unlike anything I've experienced.",
    name: "Claudia R.",
    age: "Age 39",
    initials: "CR",
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
  {
    quote:
      "I came for the therapies. I stayed for the people. The running club has transformed my relationship with movement.",
    name: "James H.",
    age: "Age 52",
    initials: "JH",
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
  {
    quote:
      "The hyperbaric sessions combined with personalized protocols have made a measurable difference in my recovery.",
    name: "Dr. Sofia M.",
    age: "Age 44",
    initials: "SM",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
  // Group 2
  {
    quote:
      "Coming here twice a week has become non-negotiable. It's where I reset and come back sharper.",
    name: "Elena K.",
    age: "Age 41",
    initials: "EK",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
  {
    quote:
      "The IV protocols and cold exposure have genuinely shifted my energy levels. Science-backed and results-driven.",
    name: "Thomas B.",
    age: "Age 55",
    initials: "TB",
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
  {
    quote:
      "I never expected to find a real community in a wellness club. The people here are extraordinary.",
    name: "Natalie W.",
    age: "Age 36",
    initials: "NW",
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
  {
    quote:
      "As a physician, I'm selective about longevity claims. Essentia delivers evidence-based care with real integrity.",
    name: "Dr. Rafael A.",
    age: "Age 49",
    initials: "RA",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
  // Group 3
  {
    quote:
      "The space itself inspires. Every detail — the light, the materials, the quiet — tells you this place is serious.",
    name: "Isabelle D.",
    age: "Age 43",
    initials: "ID",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
  {
    quote:
      "Red light therapy and contrast bathing have become my weekly anchor. My recovery has never been this consistent.",
    name: "Oliver P.",
    age: "Age 38",
    initials: "OP",
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
  {
    quote:
      "Founding membership was the best investment I've made in myself. The access and the advisor relationship are unmatched.",
    name: "Caroline F.",
    age: "Age 46",
    initials: "CF",
    bgColor: "bg-sand-50",
    textColor: "text-petroleum-700",
    avatarBg: "bg-petroleum-100",
    avatarText: "text-petroleum-700",
    mutedColor: "text-petroleum-400",
  },
  {
    quote:
      "I've been to wellness clubs across Europe. Nothing compares to what Essentia has built in Tenerife.",
    name: "Marco L.",
    age: "Age 51",
    initials: "ML",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
];

const GROUPS = [
  testimonials.slice(0, 4),
  testimonials.slice(4, 8),
  testimonials.slice(8, 12),
];

// ─── TestimonialCard ───────────────────────────────────────────

function TestimonialCard({
  t,
  compact = false,
}: {
  t: (typeof testimonials)[number];
  compact?: boolean;
}) {
  return (
    <div
      className={`${t.bgColor} relative flex h-full flex-col justify-between rounded-2xl ${
        compact ? "gap-4 p-5" : "gap-6 p-7"
      }`}
    >
      <svg
        aria-hidden="true"
        className={`absolute top-4 left-5 h-8 w-8 opacity-15 ${t.textColor}`}
        viewBox="0 0 44 44"
        fill="currentColor"
      >
        <path d="M10 28c0-5.523 4.477-10 10-10V12C9.402 12 1 20.402 1 31v1h9v-4zm20 0c0-5.523 4.477-10 10-10V12c-10.598 0-19 8.402-19 19v1h9v-4z" />
      </svg>
      <p
        className={`font-body ${t.textColor} leading-snug ${
          compact ? "pt-5 text-lg" : "pt-6 text-xl"
        }`}
      >
        {t.quote}
      </p>
      <div className="flex items-center gap-3">
        <div
          className={`${t.avatarBg} ${t.avatarText} flex shrink-0 items-center justify-center rounded-full font-medium ${
            compact ? "h-8 w-8 text-xs" : "h-10 w-10 text-xs"
          }`}
        >
          {t.initials}
        </div>
        <div>
          <p
            className={`${t.textColor} font-medium ${compact ? "text-xs" : "text-sm"}`}
          >
            {t.name}
          </p>
          <p className={`${t.mutedColor} text-xs`}>{t.age}</p>
        </div>
      </div>
    </div>
  );
}

// ─── DesktopSlider ─────────────────────────────────────────────

type DesktopSliderProps = {
  sliderRef: { current: HTMLDivElement | null };
  groupRefs: { current: (HTMLDivElement | null)[] };
};

function DesktopSlider({ sliderRef, groupRefs }: DesktopSliderProps) {
  return (
    <div
      ref={sliderRef}
      className="relative hidden h-64 overflow-hidden md:block"
    >
      {GROUPS.map((group, gi) => (
        <div
          key={gi}
          ref={(el) => {
            groupRefs.current[gi] = el;
          }}
          className="absolute inset-0 flex flex-row gap-4 px-5"
        >
          {group.map((t) => (
            <TestimonialCard key={t.name} t={t} compact />
          ))}
        </div>
      ))}
    </div>
  );
}

// ─── MobileSlider ──────────────────────────────────────────────

type MobileSliderProps = {
  mobileTrackRef: { current: HTMLDivElement | null };
};

function MobileSlider({ mobileTrackRef }: MobileSliderProps) {
  return (
    <div className="px-5 md:hidden">
      <div
        ref={mobileTrackRef}
        className="flex snap-x snap-mandatory gap-4 overflow-x-auto scroll-smooth pb-2"
        style={{ scrollbarWidth: "none" }}
      >
        {testimonials.map((t) => (
          <div
            key={t.name}
            className="shrink-0 snap-center"
            style={{ width: "calc(100vw - 60px)" }}
          >
            <TestimonialCard t={t} />
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── SliderDots ────────────────────────────────────────────────

type SliderDotsProps = {
  dotsRef: { current: HTMLDivElement | null };
  mobileActiveCard: number;
  activeGroup: number;
  mobileTrackRef: { current: HTMLDivElement | null };
  transitionTo: (idx: number) => void;
  resetAutoplay: () => void;
};

function SliderDots({
  dotsRef,
  mobileActiveCard,
  activeGroup,
  mobileTrackRef,
  transitionTo,
  resetAutoplay,
}: SliderDotsProps) {
  return (
    <div ref={dotsRef}>
      {/* Mobile: 1 dot per testimonial */}
      <div className="mt-6 flex items-center justify-center gap-2 md:hidden">
        {testimonials.map((t, i) => (
          <button
            key={t.name}
            aria-label={`Go to testimonial ${i + 1}`}
            className="cursor-pointer p-1"
            onClick={() => {
              const track = mobileTrackRef.current;
              if (!track) return;
              const cardWidth = track.scrollWidth / testimonials.length;
              track.scrollTo({ left: i * cardWidth, behavior: "smooth" });
            }}
          >
            <span
              className={`block h-2 w-2 rounded-full transition-colors duration-300 ${
                mobileActiveCard === i
                  ? "bg-petroleum-500"
                  : "bg-petroleum-500/10"
              }`}
            />
          </button>
        ))}
      </div>

      {/* Desktop: 1 dot per group */}
      <div className="mt-8 hidden items-center justify-center gap-3 md:flex">
        {GROUPS.map((_, gi) => (
          <button
            key={gi}
            aria-label={`Go to slide ${gi + 1}`}
            className="cursor-pointer p-2"
            onClick={() => {
              transitionTo(gi);
              resetAutoplay();
            }}
          >
            <span
              className={`block h-3 w-3 rounded-full transition-colors duration-300 ${
                activeGroup === gi ? "bg-petroleum-500" : "bg-petroleum-500/10"
              }`}
            />
          </button>
        ))}
      </div>
    </div>
  );
}

// ─── Testimonials ──────────────────────────────────────────────

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const dotsRef = useRef<HTMLDivElement>(null);
  const mobileTrackRef = useRef<HTMLDivElement>(null);
  const groupRefs = useRef<(HTMLDivElement | null)[]>([null, null, null]);
  const animatingRef = useRef(false);
  const activeGroupRef = useRef(0);
  const autoplayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const scrubDoneRef = useRef(false);

  const [activeGroup, setActiveGroup] = useState(0);
  const [mobileActiveCard, setMobileActiveCard] = useState(0);

  // ─── Carousel transition (x-based slide) ───────────────────

  const transitionTo = useCallback((nextIdx: number) => {
    if (animatingRef.current) return;
    const prevIdx = activeGroupRef.current;
    if (prevIdx === nextIdx) return;

    const prevEl = groupRefs.current[prevIdx];
    const nextEl = groupRefs.current[nextIdx];
    if (!prevEl || !nextEl) return;

    animatingRef.current = true;
    activeGroupRef.current = nextIdx;
    setActiveGroup(nextIdx);

    const prevCards = Array.from(prevEl.children);
    const nextCards = Array.from(nextEl.children);

    // Slide out to left
    gsap.to(prevCards, {
      x: -50,
      opacity: 0,
      stagger: 0.05,
      duration: 0.25,
      ease: "power2.in",
      onComplete: () => {
        gsap.set(prevEl, { opacity: 0, pointerEvents: "none" });
        gsap.set(prevCards, { x: 0 }); // reset x for future re-use

        // Slide in from right
        gsap.set(nextEl, { opacity: 1, pointerEvents: "auto" });
        gsap.set(nextCards, { opacity: 0, x: 50 });
        gsap.to(nextCards, {
          opacity: 1,
          x: 0,
          stagger: 0.08,
          duration: 0.4,
          ease: "power3.out",
          onComplete: () => {
            animatingRef.current = false;
          },
        });
      },
    });
  }, []);

  // ─── Autoplay (only after scrub completes) ──────────────────

  const resetAutoplay = useCallback(() => {
    if (autoplayRef.current) clearInterval(autoplayRef.current);
    autoplayRef.current = setInterval(() => {
      if (!scrubDoneRef.current) return;
      transitionTo((activeGroupRef.current + 1) % 3);
    }, 5000);
  }, [transitionTo]);

  useEffect(() => {
    resetAutoplay();
    return () => {
      if (autoplayRef.current) clearInterval(autoplayRef.current);
    };
  }, [resetAutoplay]);

  // ─── GSAP: pin+scrub desktop / entrance mobile ──────────────

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const header = headerRef.current;
    const slider = sliderRef.current;
    const dots = dotsRef.current;
    const group0 = groupRefs.current[0];
    if (!section || !inner || !header || !slider || !dots || !group0) return;

    // Initial state: groups 1 & 2 hidden, group 0 visible, dots hidden
    [1, 2].forEach((i) => {
      const el = groupRefs.current[i];
      if (el) gsap.set(el, { opacity: 0, pointerEvents: "none" });
    });
    gsap.set(group0, { opacity: 1, pointerEvents: "auto" });
    gsap.set(dots, { opacity: 0 });

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const cards0 = Array.from(group0.children);

      // ── Desktop: pin + scrub ────────────────────────────────
      mm.add("(min-width: 768px)", () => {
        gsap.set(header, { opacity: 0, y: 30 });
        gsap.set(cards0, { opacity: 0, x: 60 });

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
            onLeave: () => {
              scrubDoneRef.current = true;
              resetAutoplay();
            },
            onEnterBack: () => {
              scrubDoneRef.current = false;
              if (autoplayRef.current) clearInterval(autoplayRef.current);
            },
          },
        });

        tl.to(header, { opacity: 1, y: 0, duration: 0.2, ease: "power3.out" });
        tl.to(
          cards0,
          {
            opacity: 1,
            x: 0,
            stagger: 0.1,
            duration: 0.35,
            ease: "power3.out",
          },
          "-=0.05",
        );
        tl.to(dots, { opacity: 1, duration: 0.1 }, "-=0.05");
      });

      // ── Mobile: scroll-triggered entrance ──────────────────
      mm.add("(max-width: 767px)", () => {
        gsap.set(cards0, { opacity: 0, y: 30 });

        gsap.from(header, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: header, start: "top 85%", once: true },
        });

        gsap.to(cards0, {
          opacity: 1,
          y: 0,
          stagger: 0.1,
          duration: 0.5,
          ease: "power3.out",
          scrollTrigger: {
            trigger: slider,
            start: "top 80%",
            once: true,
            onEnter: () => {
              gsap.to(dots, { opacity: 1, duration: 0.3, delay: 0.4 });
              scrubDoneRef.current = true;
            },
          },
        });
      });
    }, section);

    return () => ctx.revert();
  }, [resetAutoplay]);

  // ─── Mobile scroll → sync dot ────────────────────────────────

  useEffect(() => {
    const track = mobileTrackRef.current;
    if (!track) return;
    const onScroll = () => {
      const { scrollLeft, scrollWidth, clientWidth } = track;
      const maxScroll = scrollWidth - clientWidth;
      if (maxScroll <= 0) return;
      const cardIdx = Math.min(
        testimonials.length - 1,
        Math.round((scrollLeft / maxScroll) * (testimonials.length - 1)),
      );
      setMobileActiveCard(cardIdx);
      const group = Math.min(GROUPS.length - 1, Math.floor(cardIdx / 4));
      setActiveGroup(group);
      activeGroupRef.current = group;
    };
    track.addEventListener("scroll", onScroll, { passive: true });
    return () => track.removeEventListener("scroll", onScroll);
  }, []);

  // ─── Render ──────────────────────────────────────────────────

  return (
    <section ref={sectionRef} className="bg-sand-100 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        {/*
          Desktop: flex-col, justify-center, gap-10 — header + full-width slider + dots stack vertically.
          Mobile: single padded column as before.
        */}
        <div className="flex flex-col pt-24 pb-16 md:h-full md:justify-center md:gap-10 md:pt-36 md:pb-16">
          {/* Header — constrained width */}
          <div
            ref={headerRef}
            className="px-5 text-center md:mx-auto md:w-full md:max-w-4xl"
          >
            <h2 className="font-display text-petroleum-700 mt-3 mb-4 text-3xl md:text-5xl">
              Heard from
              <br />
              those who know.
            </h2>
          </div>

          {/* Desktop slider — FULL WIDTH, no horizontal padding */}
          <DesktopSlider sliderRef={sliderRef} groupRefs={groupRefs} />

          {/* Mobile slider — padded */}
          <MobileSlider mobileTrackRef={mobileTrackRef} />

          {/* Dots — hidden until animation reveals them */}
          <SliderDots
            dotsRef={dotsRef}
            mobileActiveCard={mobileActiveCard}
            activeGroup={activeGroup}
            mobileTrackRef={mobileTrackRef}
            transitionTo={transitionTo}
            resetAutoplay={resetAutoplay}
          />
        </div>
      </div>
    </section>
  );
}
