"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";

gsap.registerPlugin(ScrollTrigger);

// ─── Data ──────────────────────────────────────────────────────

const services = [
  {
    number: "01",
    href: "/wellness",
    img: "/images/menu/wellness.webp",
    title: "Wellness",
    description:
      "Thermal contrast, breathwork, manual therapies, and red light — a full spectrum of body restoration.",
    cta: "Explore Wellness",
  },
  {
    number: "02",
    href: "/medicine",
    img: "/images/menu/medicine.webp",
    title: "Medicine",
    description:
      "Regenerative protocols, IV therapy, and hyperbaric oxygen — clinical science in service of longevity.",
    cta: "Explore Medicine",
  },
  {
    number: "03",
    href: "/community",
    img: "/images/menu/community.webp",
    title: "Community",
    description:
      "Running club, education programs, and exclusive memberships — belonging to something meaningful.",
    cta: "Explore Community",
  },
];

// ─── ServicesOverview ──────────────────────────────────────────

export default function ServicesOverview() {
  const sectionRef = useRef<HTMLElement>(null);
  const sectionHeaderRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const header = sectionHeaderRef.current;
    const cardsContainer = cardsRef.current;
    if (!section || !header || !cardsContainer) return;

    const ctx = gsap.context(() => {
      gsap.from(header, {
        opacity: 0,
        y: 40,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: {
          trigger: header,
          start: "top 75%",
          once: true,
        },
      });

      const cards = cardsContainer.querySelectorAll("[data-service-card]");
      gsap.from(cards, {
        opacity: 0,
        y: 60,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.12,
        scrollTrigger: {
          trigger: cardsContainer,
          start: "top 75%",
          once: true,
        },
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-sand-50 py-20 md:py-32">
      <div className="mx-auto max-w-4xl px-5">
        {/* ─── Section Header ───────────────────────────────── */}
        <div ref={sectionHeaderRef} className="mb-12">
          <p className="text-petroleum-400 mb-3 text-xs tracking-widest uppercase">
            What we offer
          </p>
          <h2 className="font-display text-petroleum-700 text-3xl md:text-5xl">
            Three pillars,
            <br />
            one intention.
          </h2>
          <p className="text-petroleum-400 mt-2">
            Science, body, and community — working as one.
          </p>
        </div>

        {/* ─── Cards Grid ───────────────────────────────────── */}
        <div
          ref={cardsRef}
          className="grid grid-cols-1 gap-4 md:grid-cols-3"
        >
          {services.map((service) => (
            <Link
              key={service.href}
              href={service.href}
              data-service-card
              className="group relative h-80 overflow-hidden rounded-2xl md:h-96"
            >
              <Image
                src={service.img}
                alt={service.title}
                fill
                sizes="(max-width: 767px) 100vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgb(9 33 33 / 0.92), rgb(9 33 33 / 0.3), transparent)",
                }}
              />
              <span className="absolute top-4 right-4 text-xs text-white/50">
                {service.number}
              </span>
              <div className="absolute bottom-0 left-0 p-6">
                <h3 className="font-display text-2xl text-white">
                  {service.title}
                </h3>
                <p className="mt-1 text-sm text-white/70">
                  {service.description}
                </p>
                <span className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-white bg-transparent px-3 text-sm font-medium text-white transition-all duration-200 group-hover:bg-white/10">
                  {service.cta}
                </span>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
