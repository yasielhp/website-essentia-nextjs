"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";
import type { ManualTherapyTreatment } from "@/data/services-data";

gsap.registerPlugin(ScrollTrigger);

// ─── Hero ─────────────────────────────────────────────────────

function ServiceHero({ service }: { service: ManualTherapyTreatment }) {
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (heroRef.current) {
        gsap.from(Array.from(heroRef.current.children), {
          opacity: 0,
          y: 25,
          stagger: 0.12,
          duration: 0.8,
          ease: "power3.out",
          delay: 0.1,
        });
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="relative flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <Image
        src={service.image}
        alt={service.title}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(9 33 33 / 0.45), rgb(9 33 33 / 0.82))",
        }}
      />
      <div ref={heroRef} className="relative mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          {service.title}.
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          {service.description}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            href={`/booking?service=${service.id}`}
          >
            Book a session
          </Button>
          <Button
            variant="outline-white"
            size="md"
            onClick={() => {
              const el = document.getElementById("details");
              if (el) {
                const top =
                  el.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top, behavior: "smooth" });
              }
            }}
          >
            Learn more
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Details ──────────────────────────────────────────────────

function ServiceDetails({ service }: { service: ManualTherapyTreatment }) {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      const inner = innerRef.current;
      const body = bodyRef.current;
      if (!section || !inner || !body) return;

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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section id="details" ref={sectionRef} className="bg-sand-50 md:h-[320vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col gap-12">
            {/* Body text */}
            <div className="md:max-w-lg">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                About this treatment.
              </h2>
              <p className="text-petroleum-500 mt-6 leading-relaxed">
                {service.body}
              </p>
            </div>

            {/* Highlights grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {service.highlights.map((h, i) => (
                <div key={i} className="bg-sand-100 rounded-2xl p-6">
                  <h3 className="text-petroleum-700 font-medium">{h.title}</h3>
                  <p className="text-petroleum-500 mt-2 text-sm leading-relaxed">
                    {h.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────

function ServiceCta({ service }: { service: ManualTherapyTreatment }) {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      const section = sectionRef.current;
      const inner = innerRef.current;
      const body = bodyRef.current;
      if (!section || !inner || !body) return;

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
        tl.to(children, {
          opacity: 1,
          y: 0,
          stagger: 0.15,
          duration: 0.35,
          ease: "power3.out",
        });
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
    }, sectionRef);

    return () => ctx.revert();
  }, []);

  return (
    <section ref={sectionRef} className="bg-petroleum-700 md:h-[220vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-16 text-center md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col items-center gap-6">
            <h2 className="font-display text-sand-50 text-3xl text-balance md:text-4xl">
              Ready to begin?
            </h2>
            <p className="text-sand-500 max-w-md leading-relaxed">
              Reserve your {service.title} session at Essentia Wellness Club —
              Baobab Suites, Costa Adeje, Tenerife.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button
                variant="white"
                size="md"
                href={`/booking?service=${service.id}`}
              >
                Book a session
              </Button>
              <Button
                variant="outline-white"
                size="md"
                href="/wellness/manual-therapies#treatments"
              >
                View all treatments
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page view ────────────────────────────────────────────────

export function ServiceDetailView({
  service,
}: {
  service: ManualTherapyTreatment;
}) {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceDetails service={service} />
      <ServiceCta service={service} />
    </>
  );
}
