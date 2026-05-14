"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Button } from "@components/ui/button";
import { principles, team } from "@data/about-data";

gsap.registerPlugin(ScrollTrigger);

// ─── Hero ─────────────────────────────────────────────────────

function AboutHero() {
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
        src="/images/home/bento-img-3.webp"
        alt="Essentia — interior of the club in Costa Adeje"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(9 33 33 / 0.55), rgb(9 33 33 / 0.78))",
        }}
      />
      <div ref={heroRef} className="relative mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          Built for people
          <br />
          who take health seriously.
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          A longevity club in Costa Adeje, Tenerife. Medicine, wellness, and
          community under one roof.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button variant="white" size="md" href="/community/memberships">
            Join the community
          </Button>
          <Button variant="outline-white" size="md" href="/contact">
            Talk to us
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Story ────────────────────────────────────────────────────

function StorySection() {
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
    <section ref={sectionRef} className="bg-sand-50 md:h-[260vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div
            ref={bodyRef}
            className="grid grid-cols-1 gap-12 md:grid-cols-2 md:gap-20"
          >
            <div className="flex flex-col gap-6">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                Why we exist.
              </h2>
              <p className="text-petroleum-500 leading-relaxed">
                Essentia was founded with one question: what does it actually
                take to live well for longer? Not in theory, but in practice,
                every day.
              </p>
              <p className="text-petroleum-500 leading-relaxed">
                We brought together the best of longevity medicine,
                evidence-based wellness, and genuine human connection, and built
                a place in the Canary Islands where all three happen under one
                roof.
              </p>
              <p className="text-petroleum-500 leading-relaxed">
                Membership is not a gym pass. It is access to a medical team, a
                community of people with the same standards, and the protocols
                to match.
              </p>
            </div>

            <div className="flex flex-col gap-6">
              <div className="relative h-64 overflow-hidden rounded-2xl md:h-80">
                <Image
                  src="/images/home/bento-img-1.webp"
                  alt="Essentia treatment room"
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="grid grid-cols-3 gap-4">
                {[
                  { value: "2021", label: "Founded" },
                  { value: "4", label: "Expert disciplines" },
                  { value: "Tenerife", label: "Costa Adeje" },
                ].map((stat) => (
                  <div key={stat.label} className="flex flex-col gap-1">
                    <p className="font-display text-petroleum-700 text-2xl">
                      {stat.value}
                    </p>
                    <p className="text-petroleum-400 text-xs">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Principles ───────────────────────────────────────────────

function PrinciplesSection() {
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
    <section ref={sectionRef} className="bg-petroleum-700 md:h-[260vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col gap-12 md:gap-16">
            <div className="md:max-w-lg">
              <h2 className="font-display text-sand-50 text-3xl md:text-4xl">
                How we think.
              </h2>
              <p className="text-sand-500 mt-4 leading-relaxed">
                Three principles that guide every decision we make, from the
                protocols we offer to the people we hire.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {principles.map((p) => (
                <div key={p.number}>
                  <span className="font-display text-petroleum-500 text-5xl">
                    {p.number}
                  </span>
                  <h3 className="text-sand-100 mt-3 text-lg font-medium">
                    {p.title}
                  </h3>
                  <p className="text-sand-500 mt-2 text-sm leading-relaxed">
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

// ─── Team ─────────────────────────────────────────────────────

function TeamSection() {
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      if (!wrapperRef.current) return;
      const children = Array.from(wrapperRef.current.children) as HTMLElement[];
      children.forEach((child) => {
        gsap.fromTo(
          child,
          { opacity: 0, y: 30 },
          {
            opacity: 1,
            y: 0,
            ease: "power3.out",
            scrollTrigger: {
              trigger: child,
              start: "top 88%",
              end: "top 55%",
              scrub: 0.6,
            },
          },
        );
      });
    });
    return () => ctx.revert();
  }, []);

  return (
    <section className="bg-sand-50">
      <div className="mx-auto max-w-4xl px-5 pt-24 pb-20">
        <div className="mb-12 md:max-w-lg">
          <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            The people.
          </h2>
          <p className="text-petroleum-400 mt-4 leading-relaxed">
            A small, expert team. Each person here because they genuinely
            believe in the work.
          </p>
        </div>

        <div
          ref={wrapperRef}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 md:grid-cols-4"
        >
          {team.map((member) => (
            <div
              key={member.name}
              className="bg-sand-100 flex flex-col gap-4 rounded-2xl p-6"
            >
              <div className="bg-petroleum-100 flex size-12 items-center justify-center rounded-full">
                <span className="text-petroleum-700 text-sm font-semibold">
                  {member.initials}
                </span>
              </div>
              <div>
                <p className="text-petroleum-700 leading-snug font-medium">
                  {member.name}
                </p>
                <p className="text-petroleum-500 mt-0.5 text-sm font-medium">
                  {member.role}
                </p>
                <p className="text-petroleum-400 mt-1 text-xs leading-snug">
                  {member.area}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── CTA ──────────────────────────────────────────────────────

function CtaSection() {
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
              The best time to start is now.
            </h2>
            <p className="text-sand-500 max-w-md leading-relaxed">
              Membership gives you access to medicine, wellness, community, and
              education. Choose your tier and begin.
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button variant="white" size="md" href="/community/memberships">
                View memberships
              </Button>
              <Button variant="outline-white" size="md" href="/contact">
                Talk to us first
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AboutSection() {
  return (
    <>
      <AboutHero />
      <StorySection />
      <PrinciplesSection />
      <TeamSection />
      <CtaSection />
    </>
  );
}
