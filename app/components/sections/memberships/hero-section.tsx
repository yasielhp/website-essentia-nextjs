"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

export default function HeroSection() {
  const contentRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (contentRef.current) {
        gsap.from(Array.from(contentRef.current.children), {
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
    <section className="bg-petroleum-700 flex min-h-dvh flex-col items-center justify-center px-5 text-center">
      <div ref={contentRef} className="mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-4xl leading-tight tracking-tight text-balance md:text-6xl">
          Membership
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          Every membership includes full access to the Essentia space. What
          changes is the depth of your protocols, the priority of your booking,
          and the closeness of your care.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            onClick={() => {
              const el = document.getElementById("tiers");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("reveal-tiers"));
              }
            }}
          >
            See memberships
          </Button>
          <Button variant="outline-white" size="md" href="/contact">
            Talk to us first
          </Button>
        </div>
      </div>
    </section>
  );
}
