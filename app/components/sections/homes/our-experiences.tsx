"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const experiences = [
  {
    title: "Thermal Contrast Zone",
    description:
      "Experience the rejuvenating power of cold immersion followed by sauna therapy for optimal recovery.",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-1.webp",
  },
  {
    title: "Manual Therapies & Signature Touch",
    description:
      "Our expert therapists provide personalized massage techniques tailored to your unique needs.",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-2.webp",
  },
  {
    title: "Medical Wellness & Regenerative Medicine",
    description:
      "Advanced medical protocols designed to optimize your health and promote longevity.",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-3.webp",
  },
  {
    title: "IV Therapy Lounge",
    description:
      "Customized intravenous nutrient therapy to boost immunity, energy, and overall vitality.",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-4.webp",
  },
  {
    title: "Bio-Optimization Protocols",
    description:
      "Science-backed wellness strategies to enhance performance and cellular regeneration.",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-5.webp",
  },
  {
    title: "Essentia Running Club",
    description:
      "Join our community for guided runs along Tenerife's stunning coastal paths.",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-6.webp",
  },
];

export default function OurExperiences() {
  const sectionRef = useRef<HTMLElement>(null);
  const desktopWrapRef = useRef<HTMLDivElement>(null);
  const trackRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    const mm = gsap.matchMedia();

    // ── Desktop: pinned horizontal scroll ──────────────────────
    mm.add("(min-width: 768px)", () => {
      const track = trackRef.current;
      if (!track) return;

      const cards = track.children;
      const firstCard = cards[0] as HTMLElement;
      const lastCard = cards[cards.length - 1] as HTMLElement;

      const startX =
        (window.innerWidth - firstCard.offsetWidth) / 2 - firstCard.offsetLeft;
      const endX =
        (window.innerWidth - lastCard.offsetWidth) / 2 - lastCard.offsetLeft;
      const scrollAmount = Math.abs(startX - endX);

      const heading = headingRef.current;

      const scrollTween = gsap.fromTo(
        track,
        { x: startX },
        {
          x: endX,
          ease: "none",
          scrollTrigger: {
            trigger: desktopWrapRef.current,
            start: "top top",
            end: () => `+=${scrollAmount}`,
            scrub: 0.8,
            pin: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              const fadeStart = 0.78;
              const fadeEnd = 0.93;
              const p = self.progress;
              if (p >= fadeEnd) {
                if (heading) heading.style.opacity = "0";
              } else if (p >= fadeStart) {
                const fade = (p - fadeStart) / (fadeEnd - fadeStart);
                if (heading) heading.style.opacity = String(1 - fade);
              } else {
                if (heading) heading.style.opacity = "1";
              }
            },
          },
        },
      );

      const cardEls = gsap.utils.toArray<HTMLElement>(cards);
      cardEls.forEach((card) => {
        gsap.set(card, { opacity: 0, scale: 0.9 });
        const titleEl = card.querySelector<HTMLElement>("[data-title]");
        const descEl = card.querySelector<HTMLElement>("[data-desc]");

        gsap.fromTo(
          card,
          { scale: 0.9, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              containerAnimation: scrollTween,
              start: "left 80%",
              end: "center center",
              scrub: true,
            },
          },
        );

        gsap.fromTo(
          card,
          { scale: 1, opacity: 1 },
          {
            scale: 0.9,
            opacity: 0,
            immediateRender: false,
            ease: "none",
            scrollTrigger: {
              trigger: card,
              containerAnimation: scrollTween,
              start: "center center",
              end: "right 20%",
              scrub: true,
            },
          },
        );

        if (titleEl) {
          gsap.fromTo(
            titleEl,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                containerAnimation: scrollTween,
                start: "left 75%",
                end: "left 50%",
                scrub: true,
              },
            },
          );
        }
        if (descEl) {
          gsap.fromTo(
            descEl,
            { opacity: 0, y: 20 },
            {
              opacity: 1,
              y: 0,
              ease: "none",
              scrollTrigger: {
                trigger: card,
                containerAnimation: scrollTween,
                start: "left 70%",
                end: "left 45%",
                scrub: true,
              },
            },
          );
        }
      });
    });

    // ── Mobile: vertical scroll, cards fade up ──────────────────
    mm.add("(max-width: 767px)", () => {
      const stickyEl = section.querySelector<HTMLElement>(
        ".mobile-sticky-heading",
      );
      const gradientEl = section.querySelector<HTMLElement>(
        ".mobile-gradient-scrim",
      );
      const mobileCards =
        section.querySelectorAll<HTMLElement>(".mobile-exp-card");
      const firstCard = mobileCards[0];

      // Cards: fade up on scroll
      mobileCards.forEach((card) => {
        gsap.fromTo(
          card,
          { opacity: 0, y: 32 },
          {
            opacity: 1,
            y: 0,
            duration: 0.65,
            ease: "power2.out",
            scrollTrigger: {
              trigger: card,
              start: "top 90%",
              toggleActions: "play none none none",
            },
          },
        );
      });

      // Último card: fade out al salir por la parte superior del viewport
      const lastCard = mobileCards[mobileCards.length - 1];
      if (lastCard) {
        gsap.to(lastCard, {
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: lastCard,
            start: "top 20%",
            end: "top -5%",
            scrub: true,
          },
        });
      }

      // Gradient: aparece cuando el primer card empieza a pasar bajo el título
      if (gradientEl && firstCard) {
        gsap.fromTo(
          gradientEl,
          { opacity: 0 },
          {
            opacity: 1,
            ease: "none",
            scrollTrigger: {
              trigger: firstCard,
              start: "top 35%",
              end: "top 20%",
              scrub: true,
            },
          },
        );
      }

      // Heading: invisible antes de alcanzar la zona del logo
      if (stickyEl) {
        gsap.to(stickyEl, {
          opacity: 0,
          ease: "power1.in",
          scrollTrigger: {
            trigger: section,
            start: "bottom 35%",
            end: "bottom 15%",
            scrub: true,
          },
        });
      }
    });

    return () => mm.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-header-theme="dark"
      className="text-primary"
    >
      {/* ── Desktop: pinned horizontal scroll ── */}
      <div
        ref={desktopWrapRef}
        className="hidden h-screen overflow-hidden md:block"
      >
        <div className="max-w-10xl mx-auto flex h-screen w-full flex-col justify-start gap-14 px-8">
          <div className="max-w-10xl mx-auto w-full">
            <h2
              ref={headingRef}
              className="font-display mt-50 text-8xl"
            >
              Our Experiences
            </h2>
          </div>
          <div ref={trackRef} className="flex w-max gap-20">
            {experiences.map((exp, index) => (
              <div
                key={index}
                className="border-primary/20 flex w-[55vw] flex-row gap-8 rounded-lg border lg:w-[45vw]"
              >
                <div className="relative w-1/2 shrink-0 overflow-hidden rounded-lg">
                  <Image
                    data-img
                    src={exp.image}
                    alt={exp.title}
                    fill
                    className="object-cover"
                  />
                </div>
                <div className="flex flex-col justify-start gap-4 px-4 py-6">
                  <h3
                    data-title
                    className="font-display mt-20 text-3xl font-semibold text-balance"
                  >
                    {exp.title}
                  </h3>
                  <p data-desc className="text-primary/70 text-lg text-balance">
                    {exp.description}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Mobile: vertical cards ── */}
      <div className="md:hidden">
        {/* Sticky heading con gradiente scrim */}
        <div className="mobile-sticky-heading sticky top-0 z-10">
          <div className="bg-background px-5 pb-5 pt-28">
            <h2 className="font-display text-4xl leading-none">
              Our Experiences
            </h2>
          </div>
          <div className="mobile-gradient-scrim from-background pointer-events-none absolute inset-x-0 top-full h-14 bg-linear-to-b to-transparent opacity-0" />
        </div>

        {/* Cards con scroll */}
        <div className="flex flex-col gap-6 px-5 pb-16 pt-8">
          {experiences.map((exp, i) => (
            <div
              key={i}
              className="mobile-exp-card border-primary/20 overflow-hidden rounded-xl border"
            >
              <div className="relative aspect-video w-full overflow-hidden">
                <Image
                  src={exp.image}
                  alt={exp.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-2 p-5">
                <h3 className="font-display text-2xl">{exp.title}</h3>
                <p className="text-primary/65 text-sm leading-relaxed">
                  {exp.description}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
