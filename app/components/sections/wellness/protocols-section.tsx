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
  tall,
}: {
  treatment: (typeof treatments)[number];
  tall?: boolean;
}) {
  return (
    <Link
      href={treatment.href}
      className={[
        "group relative overflow-hidden rounded-2xl",
        tall ? "h-80 md:h-96" : "h-72 md:h-80",
      ].join(" ")}
    >
      <Image
        src={treatment.img}
        alt={treatment.title}
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
      <span className="absolute top-4 right-4 text-xs text-white/40">
        {treatment.number}
      </span>
      <div className="absolute bottom-0 left-0 p-6">
        <p className="text-sand-500 text-xs tracking-widest uppercase">
          {treatment.tagline}
        </p>
        <h3 className="font-display mt-1 text-xl text-white">
          {treatment.title}
        </h3>
        <p className="mt-2 text-sm leading-relaxed text-white/65 md:max-w-xs">
          {treatment.description}
        </p>
        <span className="mt-4 inline-flex h-8 items-center gap-1.5 rounded-full border border-white/40 bg-transparent px-3 text-xs font-medium text-white transition-all duration-200 group-hover:border-white group-hover:bg-white/10">
          Explore
        </span>
      </div>
    </Link>
  );
}

// ─── ProtocolsSection ─────────────────────────────────────────

export default function ProtocolsSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const inner = innerRef.current;
    const body = bodyRef.current;
    if (!section || !inner || !body) return;

    const ctx = gsap.context(() => {
      const children = Array.from(body.children) as HTMLElement[];
      const mm = gsap.matchMedia();

      mm.add("(min-width: 768px)", () => {
        gsap.set(children, { opacity: 0, y: 40 });
        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: inner,
          },
        });
        tl.to(children[0], {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power3.out",
        });
        tl.to(
          children[1],
          { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" },
          "-=0.05",
        );
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1,
              y: 0,
              scale: 1,
              ease: "none",
              scrollTrigger: {
                trigger: child,
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

  const [first, second, third, fourth, fifth] = treatments;

  return (
    <section
      ref={sectionRef}
      id="protocols"
      className="bg-sand-50 md:h-[320vh]"
    >
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-5xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-8">
            {/* ── Header ── */}
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                The protocols.
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                Five modalities. One integrated system.
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
