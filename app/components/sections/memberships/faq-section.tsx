"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Link from "next/link";
import { Accordion } from "@components/ui/accordion";
import { faqs } from "./data";

gsap.registerPlugin(ScrollTrigger);

export default function FaqSection() {
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
    <section ref={sectionRef} className="bg-sand-50 md:h-[300vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-2xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-10">
            {/* ── Header ── */}
            <div className="text-center">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                Common questions.
              </h2>
            </div>

            {/* ── Accordion ── */}
            <div>
              <Accordion.Group className="divide-petroleum-100 divide-y">
                {faqs.map((faq) => (
                  <Accordion key={faq.q} className="py-1">
                    <Accordion.Header>
                      <span className="text-petroleum-700 text-left text-base font-medium">
                        {faq.q}
                      </span>
                    </Accordion.Header>
                    <Accordion.Content>
                      <p className="text-petroleum-500 pb-5 text-sm leading-7">
                        {faq.a}
                      </p>
                    </Accordion.Content>
                  </Accordion>
                ))}
              </Accordion.Group>
              <p className="text-petroleum-400 mt-10 text-center text-sm">
                Still have questions?{" "}
                <Link
                  href="/contact"
                  className="text-petroleum-700 underline underline-offset-2 transition-opacity hover:opacity-70"
                >
                  Get in touch
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
