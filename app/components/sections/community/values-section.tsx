"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useTranslations } from "next-intl";
import { valueKeys, valueNumbers } from "./data";

gsap.registerPlugin(ScrollTrigger);

export default function ValuesSection() {
  const t = useTranslations("community.values");
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
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col gap-12 md:gap-16">
            {/* ── Header ── */}
            <div className="md:max-w-lg">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("heading")}
                <br />
                {t("headingBreak")}
              </h2>
              <p className="text-petroleum-400 mt-4 leading-relaxed">
                {t("body")}
              </p>
            </div>

            {/* ── Values ── */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {valueKeys.map((k) => (
                <div key={k}>
                  <span className="font-display text-petroleum-200 text-5xl">
                    {valueNumbers[k]}
                  </span>
                  <h3 className="text-petroleum-700 mt-3 text-lg font-medium">
                    {t(`items.${k}.title`)}
                  </h3>
                  <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                    {t(`items.${k}.description`)}
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
