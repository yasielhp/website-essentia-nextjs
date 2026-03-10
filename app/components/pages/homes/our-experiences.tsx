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
  const trackRef = useRef<HTMLDivElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const track = trackRef.current;
    if (!section || !track) return;

    const ctx = gsap.context(() => {
      const cards = track.children;
      const firstCard = cards[0] as HTMLElement;
      const lastCard = cards[cards.length - 1] as HTMLElement;

      const startX =
        (window.innerWidth - firstCard.offsetWidth) / 2 - firstCard.offsetLeft;
      const endX =
        (window.innerWidth - lastCard.offsetWidth) / 2 - lastCard.offsetLeft;
      const scrollAmount = Math.abs(startX - endX);

      const heading = headingRef.current;

      // Main horizontal scroll tween
      const scrollTween = gsap.fromTo(
        track,
        { x: startX },
        {
          x: endX,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: () => `+=${scrollAmount}`,
            scrub: 0.8,
            pin: true,
            invalidateOnRefresh: true,
            onUpdate: (self) => {
              // Fade out heading near end of horizontal scroll
              const headingFadeStart = 0.92;
              if (self.progress >= headingFadeStart) {
                const fade =
                  (self.progress - headingFadeStart) / (1 - headingFadeStart);
                if (heading) heading.style.opacity = String(1 - fade);
              } else {
                if (heading) heading.style.opacity = "1";
              }
            },
          },
        },
      );

      // Fade out content tied to scroll after unpin
      const content = contentRef.current;
      if (content) {
        gsap.to(content, {
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: () => `+=${scrollAmount}`,
            end: () => `+=${scrollAmount + window.innerHeight * 0.5}`,
            scrub: true,
          },
        });
      }

      // Per-card effects using containerAnimation
      const cardEls = gsap.utils.toArray<HTMLElement>(cards);
      cardEls.forEach((card) => {
        gsap.set(card, { opacity: 0, scale: 0.9 });
        const titleEl = card.querySelector<HTMLElement>("[data-title]");
        const descEl = card.querySelector<HTMLElement>("[data-desc]");

        // Spotlight: scale up + full opacity when entering center
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

        // Reverse: shrink when leaving center
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

        // Text fade + slide
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
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-header-theme="dark"
      className="text-primary overflow-hidden"
    >
      <div ref={contentRef} className="flex h-dvh w-full flex-col justify-center gap-6 px-4 md:gap-14 md:px-8">
        <div className="max-w-10xl mx-auto w-full">
          <h2 ref={headingRef} className="font-display mt-20 px-6 text-4xl md:mt-20 md:text-8xl">
            Our Experiences
          </h2>
        </div>
        <div ref={trackRef} className="flex w-max gap-10 md:gap-20">
          {experiences.map((exp, index) => (
            <div
              key={index}
              className="border-primary/20 flex w-[85vw] flex-col rounded-lg border md:w-[60vw] md:flex-row md:gap-8 lg:w-[45vw]"
            >
              <div className="relative aspect-3/4 h-80 shrink-0 overflow-hidden rounded-lg md:h-full md:w-1/2">
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
                  className="font-display text-2xl font-semibold text-balance md:mt-20 md:text-3xl"
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
    </section>
  );
}
