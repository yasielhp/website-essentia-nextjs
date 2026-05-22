"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";

gsap.registerPlugin(ScrollTrigger);

// ─── Data ──────────────────────────────────────────────────────

type ServiceKey = "wellness" | "medicine" | "community";

const services: ReadonlyArray<{
  key: ServiceKey;
  number: string;
  href: string;
  img: string;
}> = [
  {
    key: "wellness",
    number: "01",
    href: "/wellness",
    img: "/images/menu/wellness.webp",
  },
  {
    key: "medicine",
    number: "02",
    href: "/medicine",
    img: "/images/menu/medicine.webp",
  },
  {
    key: "community",
    number: "03",
    href: "/community",
    img: "/images/menu/community.webp",
  },
];

// ─── ServicesOverview ──────────────────────────────────────────

export default function ServicesOverview() {
  const t = useTranslations("home.servicesOverview");
  const tServices = useTranslations("home.servicesOverview.services");
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    if (!section || !inner) return;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();
      const cards = inner.querySelectorAll("[data-service-card]");

      mm.add("(min-width: 768px)", () => {
        gsap.set(headerRef.current, { opacity: 0, y: 40 });
        gsap.set(cards, { opacity: 0, y: 60 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(headerRef.current, {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: "power3.out",
        });
        tl.to(
          cards,
          {
            opacity: 1,
            y: 0,
            stagger: 0.15,
            duration: 0.5,
            ease: "power3.out",
          },
          "-=0.1",
        );
      });

      mm.add("(max-width: 767px)", () => {
        gsap.from(headerRef.current, {
          opacity: 0,
          y: 30,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: headerRef.current,
            start: "top 85%",
            once: true,
          },
        });
        Array.from(cards).forEach((card) => {
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
    <section ref={sectionRef} className="bg-sand-50 md:h-[300vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          {/* ─── Section Header ───────────────────────────────── */}
          <div ref={headerRef} className="mb-12">
            <h2 className="font-display text-petroleum-700 text-3xl md:text-5xl">
              {t("sectionHeadline")}
              <br />
              {t("sectionHeadline2")}
            </h2>
            <p className="text-petroleum-400 mt-2">{t("sectionSubheadline")}</p>
          </div>

          {/* ─── Cards Grid ───────────────────────────────────── */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {services.map((service) => {
              const title = tServices(`${service.key}.title`);
              const description = tServices(`${service.key}.description`);
              return (
                <Link
                  key={service.href}
                  href={service.href}
                  data-service-card
                  className="group relative h-80 overflow-hidden rounded-2xl md:h-96"
                >
                  <Image
                    src={service.img}
                    alt={title}
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
                    <h3 className="font-body text-2xl text-white">{title}</h3>
                    <p className="mt-1 text-sm text-white/70">{description}</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
}
