"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ─── Data ──────────────────────────────────────────────────────

const testimonials = [
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
      "The combination of medical protocols and the community here is unlike anything I've experienced. It's become part of my weekly rhythm.",
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
      "I came for the therapies. I stayed for the people. The running club alone has transformed my relationship with movement.",
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
      "The hyperbaric sessions combined with the personalized protocols have made a measurable difference in my recovery and focus.",
    name: "Dr. Sofia M.",
    age: "Age 44",
    initials: "SM",
    bgColor: "bg-petroleum-700",
    textColor: "text-sand-50",
    avatarBg: "bg-petroleum-500",
    avatarText: "text-sand-50",
    mutedColor: "text-sand-50/60",
  },
];

// ─── Testimonials ──────────────────────────────────────────────

export default function Testimonials() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const header = headerRef.current;
    const grid = gridRef.current;
    if (!section || !inner || !header || !grid) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const cards = grid.querySelectorAll("[data-testimonial-card]");

      mm.add("(min-width: 768px)", () => {
        gsap.set(header, { opacity: 0, y: 30 });
        gsap.set(cards, { opacity: 0, y: 50 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(header, { opacity: 1, y: 0, duration: 0.2, ease: "power3.out" });
        tl.to(cards, { opacity: 1, y: 0, stagger: 0.12, duration: 0.4, ease: "power3.out" }, "-=0.05");
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(header, {
          opacity: 0, y: 30, duration: 0.7, ease: "power3.out",
          scrollTrigger: { trigger: header, start: "top 85%", once: true },
        });
        Array.from(cards).forEach((card) => {
          gsap.fromTo(card,
            { opacity: 0, y: 50, scale: 0.96 },
            {
              opacity: 1, y: 0, scale: 1, ease: "none",
              scrollTrigger: { trigger: card, start: "top 88%", end: "top 35%", scrub: 0.7 },
            }
          );
        });
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-sand-100 md:h-[280vh]">
      <div ref={innerRef} className="md:h-screen overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-36 md:pb-16">
          {/* ─── Header ───────────────────────────────────────── */}
          <div ref={headerRef} className="mb-12 text-center">
            <p className="text-petroleum-400 text-xs tracking-widest uppercase">
              Members
            </p>
            <h2 className="font-display text-petroleum-700 mt-3 text-3xl md:text-5xl">
              Heard from
              <br />
              those who know.
            </h2>
          </div>

          {/* ─── Grid ─────────────────────────────────────────── */}
          <div
            ref={gridRef}
            className="grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5"
          >
            {testimonials.map((t) => (
              <div
                key={t.name}
                data-testimonial-card
                className={`${t.bgColor} relative flex flex-col justify-between gap-6 rounded-2xl p-7`}
              >
                {/* ─── Quote Mark ─────────────────────────────── */}
                <svg
                  aria-hidden="true"
                  className={`absolute top-5 left-6 h-10 w-10 opacity-15 ${t.textColor}`}
                  viewBox="0 0 44 44"
                  fill="currentColor"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path d="M10 28c0-5.523 4.477-10 10-10V12C9.402 12 1 20.402 1 31v1h9v-4zm20 0c0-5.523 4.477-10 10-10V12c-10.598 0-19 8.402-19 19v1h9v-4z" />
                </svg>

                {/* ─── Quote Text ─────────────────────────────── */}
                <p
                  className={`font-display ${t.textColor} pt-6 text-xl leading-snug`}
                >
                  {t.quote}
                </p>

                {/* ─── Footer ─────────────────────────────────── */}
                <div className="flex items-center gap-3">
                  <div
                    className={`${t.avatarBg} ${t.avatarText} flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-medium`}
                  >
                    {t.initials}
                  </div>
                  <div>
                    <p className={`${t.textColor} text-sm font-medium`}>
                      {t.name}
                    </p>
                    <p className={`${t.mutedColor} text-xs`}>{t.age}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
