"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import { Button } from "@components/ui/button";

gsap.registerPlugin();

const details = [
  { label: "When", value: "Every Saturday, 7:30 am" },
  { label: "Meeting point", value: "Baobab Suites lobby, Costa Adeje" },
  { label: "Distance", value: "8 – 12 km depending on route" },
  { label: "Level", value: "All levels welcome" },
];

const expects = [
  {
    number: "I",
    title: "Curated routes",
    description:
      "Each week a different route through Costa Adeje — coastal paths, volcanic trails, and clifftop roads with Atlantic views.",
  },
  {
    number: "II",
    title: "Paced groups",
    description:
      "We split into pace groups so no one is left behind. Whether you run 5 min/km or 7, there is a group for you.",
  },
  {
    number: "III",
    title: "Community first",
    description:
      "The run ends with a shared breakfast. The best conversations happen after the last kilometre.",
  },
];

export default function RunningClubSection() {
  const heroRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

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
      if (contentRef.current) {
        gsap.from(Array.from(contentRef.current.children), {
          opacity: 0,
          y: 30,
          stagger: 0.1,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: {
            trigger: contentRef.current,
            start: "top 85%",
            once: true,
          },
        });
      }
    });
    return () => ctx.revert();
  }, []);

  return (
    <>
      {/* ── Hero ── */}
      <section className="relative flex min-h-dvh flex-col items-center justify-center px-5 text-center">
        <Image
          src="/images/community/running-club-hero.webp"
          alt="Essentia Running Club — coastal route in Costa Adeje"
          fill
          priority
          sizes="100vw"
          className="object-cover"
        />
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to bottom, rgb(9 33 33 / 0.55), rgb(9 33 33 / 0.72))",
          }}
        />
        <div ref={heroRef} className="relative mx-auto max-w-3xl">
          <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
            Running Club.
          </h1>
          <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
            Every Saturday morning we run together through some of the most
            dramatic coastline in the Canary Islands. No race, no ego —
            just movement and good company.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="white" size="md" href="/contact">
              Join the run
            </Button>
            <Button variant="outline-white" size="md" href="/community">
              Back to community
            </Button>
          </div>
        </div>
      </section>

      {/* ── Content ── */}
      <section className="bg-sand-50">
        <div className="mx-auto max-w-4xl px-5 py-24">
          <div ref={contentRef} className="flex flex-col gap-20">
            {/* ── Details grid ── */}
            <div className="grid grid-cols-2 gap-6 md:grid-cols-4">
              {details.map((d) => (
                <div key={d.label} className="flex flex-col gap-1">
                  <p className="text-petroleum-400 text-xs tracking-widest uppercase">
                    {d.label}
                  </p>
                  <p className="text-petroleum-700 text-sm font-medium leading-snug">
                    {d.value}
                  </p>
                </div>
              ))}
            </div>

            {/* ── Divider ── */}
            <div className="bg-sand-200 h-px w-full" />

            {/* ── What to expect ── */}
            <div className="flex flex-col gap-12">
              <div className="md:max-w-lg">
                <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                  What to expect.
                </h2>
                <p className="text-petroleum-400 mt-4 leading-relaxed">
                  The Saturday run is open to all Essentia members. No
                  sign-up needed — just show up at 7:30, ready to move.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
                {expects.map((e) => (
                  <div key={e.number}>
                    <span className="font-display text-petroleum-200 text-5xl">
                      {e.number}
                    </span>
                    <h3 className="text-petroleum-700 mt-3 text-lg font-medium">
                      {e.title}
                    </h3>
                    <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                      {e.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── CTA ── */}
      <section className="bg-petroleum-700">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 py-24 text-center">
          <h2 className="font-display text-sand-50 text-3xl text-balance md:text-4xl">
            See you Saturday.
          </h2>
          <p className="text-sand-500 mx-auto mt-4 max-w-md leading-relaxed">
            Running Club access is included with every Essentia membership.
            Contact us if you have any questions before your first run.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button variant="white" size="md" href="/community/memberships">
              View memberships
            </Button>
            <Button variant="outline-white" size="md" href="/contact">
              Get in touch
            </Button>
          </div>
        </div>
      </section>
    </>
  );
}
