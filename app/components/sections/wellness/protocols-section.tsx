"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { treatments } from "./data";

gsap.registerPlugin(ScrollTrigger);

// Extract slug from href like "/wellness/contrast-therapy"
function slugFromHref(href: string): string {
  return href.split("/").pop() ?? "";
}

// ─── TreatmentCard ────────────────────────────────────────────

function TreatmentCard({
  treatment,
  tall,
}: {
  treatment: (typeof treatments)[number];
  tall?: boolean;
}) {
  const t = useTranslations("wellness.protocols.items");
  const slug = slugFromHref(treatment.href);
  const title = t(`${slug}.title`);
  return (
    <Link
      href={treatment.href}
      data-card
      className={[
        "group relative overflow-hidden rounded-2xl",
        tall ? "h-72 md:h-72" : "h-64 md:h-64",
      ].join(" ")}
    >
      <Image
        src={treatment.img}
        alt={title}
        fill
        sizes="(max-width: 767px) 100vw, 50vw"
        className="object-cover transition-transform duration-500 group-hover:scale-105"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgb(9 33 33 / 0.92), rgb(9 33 33 / 0.3), transparent)",
        }}
      />
      <div className="absolute bottom-0 left-0 p-6">
        <h3 className="font-body text-xl text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65 md:max-w-xs">
          {t(`${slug}.description`)}
        </p>
      </div>
    </Link>
  );
}

// ─── ProtocolsSection ─────────────────────────────────────────

export default function ProtocolsSection() {
  const t = useTranslations("wellness.protocols");
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const body = bodyRef.current;
    if (!section || !inner || !body) return;

    const revealAll = () => {
      if (!bodyRef.current) return;
      const header = bodyRef.current.children[0] as HTMLElement;
      const cards = Array.from(
        bodyRef.current.querySelectorAll("[data-card]"),
      ) as HTMLElement[];
      gsap.to([header, ...cards], {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        overwrite: true,
      });
    };
    window.addEventListener("reveal-protocols", revealAll);

    const ctx = gsap.context(() => {
      const header = body.children[0] as HTMLElement;
      const cards = Array.from(
        body.querySelectorAll("[data-card]"),
      ) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        gsap.set(header, { opacity: 0, y: 40 });
        gsap.set(cards, { opacity: 0, y: 30 });

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
        tl.to(
          cards,
          {
            opacity: 1,
            y: 0,
            stagger: 0.12,
            duration: 0.25,
            ease: "power3.out",
          },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        gsap.fromTo(
          header,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            ease: "none",
            scrollTrigger: {
              trigger: header,
              start: "top 88%",
              end: "top 35%",
              scrub: 0.7,
            },
          },
        );
        cards.forEach((card) => {
          gsap.fromTo(
            card,
            { opacity: 0, y: 40, scale: 0.97 },
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

    return () => {
      ctx.revert();
      window.removeEventListener("reveal-protocols", revealAll);
    };
  }, []);

  const [first, second, third, fourth, fifth] = treatments;

  return (
    <section
      ref={sectionRef}
      id="protocols"
      className="bg-sand-50 md:h-[320vh]"
    >
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-8">
            {/* ── Header ── */}
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("heading")}
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                {t("subheading")}
              </p>
            </div>

            {/* ── Grid ── */}
            <div className="flex flex-col gap-4">
              {/* Row 1: 3 equal cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <TreatmentCard treatment={first} />
                <TreatmentCard treatment={second} />
                <TreatmentCard treatment={third} />
              </div>
              {/* Row 2: 2 wider cards */}
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <TreatmentCard treatment={fourth} tall />
                <TreatmentCard treatment={fifth} tall />
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
