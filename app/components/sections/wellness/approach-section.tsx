"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { principles } from "./data";

gsap.registerPlugin(ScrollTrigger);

export default function ApproachSection() {
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

  return (
    <section ref={sectionRef} className="bg-sand-100 md:h-[260vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-5xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col gap-12 md:gap-16">
            {/* ── Header ── */}
            <div className="md:max-w-lg">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                How we think
                <br />
                about wellness.
              </h2>
              <p className="text-petroleum-400 mt-4 leading-relaxed">
                Essentia is not a spa and not a gym. It is a precision wellness
                environment where every protocol is chosen for its measurable
                effect on your biology and your experience of being alive.
              </p>
            </div>

            {/* ── Principles ── */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {principles.map((p) => (
                <div key={p.number}>
                  <span className="font-display text-petroleum-200 text-5xl">
                    {p.number}
                  </span>
                  <h3 className="text-petroleum-700 mt-3 text-lg font-medium">
                    {p.title}
                  </h3>
                  <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                    {p.description}
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
