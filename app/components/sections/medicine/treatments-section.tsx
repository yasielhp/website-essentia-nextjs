"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import Link from "next/link";
import { treatments } from "./data";

gsap.registerPlugin(ScrollTrigger);

// ─── TreatmentCard ────────────────────────────────────────────

function TreatmentCard({
  treatment,
}: {
  treatment: (typeof treatments)[number];
}) {
  return (
    <Link
      href={treatment.href}
      data-card
      className="group relative h-72 overflow-hidden rounded-2xl md:h-80"
    >
      <Image
        src={treatment.img}
        alt={treatment.title}
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
      <div className="absolute bottom-0 left-0 p-6">
        <h3 className="font-body text-xl text-white">{treatment.title}</h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65">
          {treatment.description}
        </p>
      </div>
    </Link>
  );
}

// ─── TreatmentsSection ────────────────────────────────────────

export default function TreatmentsSection() {
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
                The treatments.
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                Three clinical protocols. One longevity system.
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
