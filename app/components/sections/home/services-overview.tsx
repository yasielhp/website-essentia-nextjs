"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

// ─── Data ──────────────────────────────────────────────────────

type ServiceKey = "wellness" | "medicine" | "experiences";

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
    img: "/images/menu/wellness-900x600.webp",
  },
  {
    key: "medicine",
    number: "02",
    href: "/medicine",
    img: "/images/menu/medicine-900x600.webp",
  },
  {
    key: "experiences",
    number: "03",
    href: "/experiences",
    img: "/images/menu/community-900x600.webp",
  },
];

// ─── ServicesOverview ──────────────────────────────────────────

export default function ServicesOverview() {
  const t = useTranslations("home.servicesOverview");
  const tServices = useTranslations("home.servicesOverview.services");
  const headerRef = useRef<HTMLDivElement>(null);
  const cardsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const header = headerRef.current;
    const cards = cardsRef.current;
    if (!header || !cards) return;

    const ctx = gsap.context(() => {
      gsap.from(header, {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
        scrollTrigger: { trigger: header, start: "top 85%", once: true },
      });

      const cardEls = cards.querySelectorAll("[data-service-card]");
      gsap.from(cardEls, {
        opacity: 0,
        y: 50,
        stagger: 0.1,
        duration: 0.6,
        ease: "power3.out",
        scrollTrigger: { trigger: cards, start: "top 85%", once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section className="bg-sand-50">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
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
          <div ref={cardsRef} className="grid grid-cols-1 gap-4 md:grid-cols-3">
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
