"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const services = [
  {
    number: "01",
    title: "Thermal Contrast Therapy",
    description:
      "Alternate between our heated sauna and cold plunge pools to accelerate recovery, reduce inflammation, and stimulate deep circulation.",
    tag: "60 – 120 min",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-1.webp",
  },
  {
    number: "02",
    title: "Signature Massage",
    description:
      "A personalized bodywork session combining Swedish, deep tissue, and myofascial release techniques tailored to your body's unique needs.",
    tag: "90 min",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-2.webp",
  },
  {
    number: "03",
    title: "Medical Wellness Consultation",
    description:
      "Comprehensive evaluation with our physicians to design a preventative protocol based on biomarkers, lifestyle, and longevity goals.",
    tag: "60 min",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-3.webp",
  },
  {
    number: "04",
    title: "IV Nutrient Therapy",
    description:
      "Custom intravenous infusions of vitamins, minerals, and amino acids to restore energy, immunity, and cellular vitality from within.",
    tag: "45 – 75 min",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-4.webp",
  },
  {
    number: "05",
    title: "Bio-Optimization Protocol",
    description:
      "A science-backed 4-week program combining nutrition coaching, sleep hygiene, structured movement, and recovery tools for measurable gains.",
    tag: "4-week program",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-5.webp",
  },
  {
    number: "06",
    title: "Running & Movement Club",
    description:
      "Expert-guided coastal runs along Tenerife's most stunning routes, complemented by strength and mobility sessions for all levels.",
    tag: "Ongoing",
    image: "https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/exp-6.webp",
  },
];

export default function Services() {
  const sectionRef = useRef<HTMLElement>(null);
  const imageRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const stStartRef = useRef(0);
  const stEndRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const section = sectionRef.current;
    if (!section) return;

    // Entrance: whole section slides up from below
    gsap.fromTo(
      section,
      { y: 80, opacity: 0 },
      {
        y: 0,
        opacity: 1,
        duration: 1,
        ease: "power3.out",
        scrollTrigger: {
          trigger: section,
          start: "top 90%",
          toggleActions: "play none none none",
        },
      },
    );

    const mm = gsap.matchMedia();

    mm.add("(min-width: 1024px)", () => {
      let lastIdx = -1;

      const st = ScrollTrigger.create({
        trigger: section,
        start: "top top",
        end: () => `+=${window.innerHeight * services.length}`,
        pin: true,
        onUpdate: (self) => {
          const idx = Math.min(
            Math.floor(self.progress * services.length),
            services.length - 1,
          );
          if (idx !== lastIdx) {
            lastIdx = idx;
            setActiveIndex(idx);
          }
        },
        onRefresh: (self) => {
          stStartRef.current = self.start;
          stEndRef.current = self.end;
        },
      });

      stStartRef.current = st.start;
      stEndRef.current = st.end;

      return () => st.kill();
    });

    // ── Mobile: gradient scrim + heading fade ──────────────────
    mm.add("(max-width: 1023px)", () => {
      const stickyEl = section.querySelector<HTMLElement>(
        ".services-sticky-heading",
      );
      const gradientEl = section.querySelector<HTMLElement>(
        ".services-gradient-scrim",
      );
      const cards = section.querySelectorAll<HTMLElement>(
        ".service-mobile-card",
      );
      const firstCard = cards[0];

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

      if (stickyEl) {
        gsap.to(stickyEl, {
          opacity: 0,
          ease: "none",
          scrollTrigger: {
            trigger: section,
            start: "bottom 15%",
            end: "bottom 2%",
            scrub: true,
          },
        });
      }
    });

    return () => mm.revert();
  }, []);

  // Animate image + content on active change
  useEffect(() => {
    if (imageRef.current) {
      gsap.fromTo(
        imageRef.current,
        { opacity: 0, scale: 1.06 },
        { opacity: 1, scale: 1, duration: 0.55, ease: "power2.out" },
      );
    }
    if (contentRef.current) {
      gsap.fromTo(
        contentRef.current,
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" },
      );
    }
  }, [activeIndex]);

  const handleClick = (i: number) => {
    if (stEndRef.current > 0) {
      const targetScroll =
        stStartRef.current +
        (i / services.length) * (stEndRef.current - stStartRef.current);
      window.scrollTo({ top: targetScroll, behavior: "smooth" });
    } else {
      setActiveIndex(i);
    }
  };

  const active = services[activeIndex];

  return (
    <section
      ref={sectionRef}
      data-header-theme="dark"
      className="text-primary lg:h-screen lg:overflow-hidden"
    >
      {/* ── DESKTOP layout ── */}
      <div className="hidden h-full items-center lg:flex">
        <div className="max-w-10xl mx-auto grid w-full grid-cols-[1.1fr_0.9fr] items-center gap-16 px-14 xl:gap-24 xl:px-20">
          {/* LEFT: active service details */}
          <div className="flex flex-col gap-7">
            <div
              ref={imageRef}
              className="relative h-72 w-full overflow-hidden rounded-xl xl:h-80"
            >
              <Image
                key={active.image}
                src={active.image}
                alt={active.title}
                fill
                className="object-cover"
                priority
              />
            </div>

            <div ref={contentRef} className="flex flex-col gap-4">
              <span className="text-primary/30 font-mono text-xs">
                {active.number}
              </span>
              <h2 className="font-display text-4xl leading-tight xl:text-5xl">
                {active.title}
              </h2>
              <p className="text-primary/55 max-w-md text-base leading-relaxed">
                {active.description}
              </p>
              <div className="mt-1 flex items-center gap-5">
                <button
                  onClick={() => handleClick(activeIndex)}
                  className="hover:shadow-hover bg-primary rounded-md px-4 py-2 text-sm font-medium text-white uppercase transition-all hover:scale-105"
                >
                  Book Now
                </button>
                <span className="text-primary/35 text-xs">{active.tag}</span>
              </div>
            </div>
          </div>

          {/* RIGHT: clickable services list */}
          <div className="flex flex-col">
            <h2 className="font-display mb-8 text-6xl leading-none xl:text-7xl">
              Services
            </h2>
            <div className="flex flex-col">
              {services.map((service, i) => (
                <button
                  key={service.number}
                  onClick={() => handleClick(i)}
                  className={`group border-primary/10 flex cursor-pointer items-baseline gap-5 border-b py-4 text-left transition-all duration-300 first:border-t ${
                    activeIndex === i
                      ? "opacity-100"
                      : "opacity-20 hover:opacity-50"
                  }`}
                >
                  <span className="text-primary/40 w-7 shrink-0 font-mono text-xs">
                    {service.number}
                  </span>
                  <span className="text-2xl leading-snug font-medium xl:text-3xl">
                    {service.title}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── MOBILE layout ── */}
      <div className="lg:hidden">
        {/* Sticky title with gradient scrim below */}
        <div className="services-sticky-heading sticky top-0 z-10">
          <div className="bg-background px-5 pt-28 pb-5">
            <h2 className="font-display text-4xl leading-none">Services</h2>
          </div>
          <div className="services-gradient-scrim from-background pointer-events-none absolute inset-x-0 top-full h-14 bg-linear-to-b to-transparent opacity-0" />
        </div>

        {/* Scrolling service cards */}
        <div className="flex flex-col px-5 pt-8 pb-24">
          {services.map((service) => (
            <div
              key={service.number}
              className="service-mobile-card border-primary/15 flex flex-col gap-5 border-t py-8 last:border-b"
            >
              <div className="relative h-52 w-full overflow-hidden rounded-lg">
                <Image
                  src={service.image}
                  alt={service.title}
                  fill
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col gap-3">
                <span className="text-primary/30 font-mono text-xs">
                  {service.number}
                </span>
                <div className="flex items-start justify-between gap-4">
                  <h3 className="font-display text-2xl leading-tight">
                    {service.title}
                  </h3>
                  <span className="text-primary/35 mt-1 shrink-0 text-xs">
                    {service.tag}
                  </span>
                </div>
                <p className="text-primary/55 text-sm leading-relaxed">
                  {service.description}
                </p>
                <button className="bg-primary mt-1 w-full rounded-md px-4 py-2.5 text-sm font-medium uppercase text-white transition-all hover:scale-105">
                  Book Now
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
