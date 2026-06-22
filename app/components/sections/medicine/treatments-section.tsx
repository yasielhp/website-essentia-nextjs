"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { treatments, type MedicineTreatment } from "./data";

gsap.registerPlugin(ScrollTrigger);

// Extract slug from href like "/medicine/hyperbaric-chambers"
function slugFromHref(href: string): string {
  return href.split("/").pop() ?? "";
}

// ─── TreatmentCard ────────────────────────────────────────────

function TreatmentCard({ treatment }: { treatment: MedicineTreatment }) {
  const t = useTranslations("medicine.treatments.items");
  const tCommon = useTranslations("common");
  const slug = slugFromHref(treatment.href);
  const title = t(`${slug}.title`);
  const className = "group relative h-72 overflow-hidden rounded-2xl md:h-80";

  const inner = (
    <>
      <Image
        src={treatment.img}
        alt={title}
        fill
        sizes="(max-width: 767px) 100vw, 33vw"
        className={[
          "object-cover",
          treatment.comingSoon
            ? "grayscale-[40%]"
            : "transition-transform duration-500 group-hover:scale-105",
        ].join(" ")}
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to top, rgb(9 33 33 / 0.92), rgb(9 33 33 / 0.3), transparent)",
        }}
      />
      {treatment.comingSoon && (
        <div className="absolute top-4 left-4">
          <span className="bg-sand-100/90 text-petroleum-700 rounded-full px-3 py-1 text-xs font-medium tracking-wide uppercase">
            {tCommon("comingSoon")}
          </span>
        </div>
      )}
      <div className="absolute bottom-0 left-0 p-6">
        <h3 className="font-body text-xl text-white">{title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {t(`${slug}.description`)}
        </p>
      </div>
    </>
  );

  if (treatment.comingSoon) {
    return (
      <div data-card className={className}>
        {inner}
      </div>
    );
  }

  return (
    <Link href={treatment.href} data-card className={className}>
      {inner}
    </Link>
  );
}

// ─── TreatmentsSection ────────────────────────────────────────

export default function TreatmentsSection() {
  const t = useTranslations("medicine.treatments");
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
    window.addEventListener("reveal-treatments", revealAll);

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
            stagger: 0.15,
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
      window.removeEventListener("reveal-treatments", revealAll);
    };
  }, []);

  return (
    <section
      ref={sectionRef}
      id="treatments"
      className="bg-sand-50 md:h-[260vh]"
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
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              {treatments.map((t) => (
                <TreatmentCard key={t.href} treatment={t} />
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
