"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { MapPin, Route, Lock } from "lucide-react";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

const details = [
  { icon: Route, value: "12 km" },
  { icon: Lock, value: "Members only" },
  { icon: MapPin, value: "Baobab Suites lobby, Costa Adeje" },
];

const expects = [
  {
    number: "I",
    title: "Curated routes",
    description:
      "Each week a different route through Costa Adeje: coastal paths, volcanic trails, and clifftop roads with Atlantic views.",
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

// ─── Hero ─────────────────────────────────────────────────────

function RunningClubHero() {
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
          dramatic coastline in the Canary Islands. No race, no ego, just
          movement and good company.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            onClick={() => {
              const el = document.getElementById("next-run");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("reveal-next-run"));
              }
            }}
          >
            Next run
          </Button>
          <Button
            variant="outline-white"
            size="md"
            href="/community/memberships"
          >
            Join the community
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Next run ─────────────────────────────────────────────────

function NextRunSection() {
  const sectionRef = useRef<HTMLElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const revealAll = () => {
      if (!bodyRef.current) return;
      gsap.to(Array.from(bodyRef.current.children), {
        opacity: 1,
        y: 0,
        duration: 0.5,
        ease: "power3.out",
        overwrite: true,
      });
    };
    window.addEventListener("reveal-next-run", revealAll);

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
          duration: 0.2,
          ease: "power3.out",
        });
        tl.to(
          children[1],
          { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" },
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

    return () => {
      ctx.revert();
      window.removeEventListener("reveal-next-run", revealAll);
    };
  }, []);

  return (
    <section ref={sectionRef} id="next-run" className="bg-sand-50 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-8">
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                Next run.
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                Show up, run, share breakfast. Every Saturday without exception.
              </p>
            </div>
            <div className="bg-sand-100 grid grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-2">
              <div className="relative h-56 md:h-auto md:min-h-72">
                <Image
                  src="/images/community/running-club-next.webp"
                  alt="Next Essentia run"
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col justify-between gap-6 p-8 md:p-10">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                      Saturday,
                      <br />
                      24 May 2026
                    </h3>
                    <p className="text-petroleum-400 mt-1 text-sm">
                      7:30 am · Baobab Suites lobby
                    </p>
                  </div>
                  <p className="text-petroleum-500 text-sm leading-relaxed">
                    This week: the Fanabe coastal path. 10 km along the seafront
                    promenade with Atlantic views from start to finish. Ends
                    with breakfast at the club.
                  </p>
                </div>
                <div className="border-sand-500 grid grid-cols-2 gap-4 border-t pt-6">
                  {details.map(({ icon: Icon, value }) => (
                    <div key={value} className="flex items-start gap-2">
                      <Icon
                        className="text-petroleum-400 mt-0.5 shrink-0"
                        size={15}
                      />
                      <p className="text-petroleum-600 text-sm leading-snug">
                        {value}
                      </p>
                    </div>
                  ))}
                </div>
                <Button
                  variant="solid"
                  size="md"
                  href="/community/running-club/register"
                  className="w-full md:w-auto md:self-start"
                >
                  Register for this run
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── What to expect ───────────────────────────────────────────

function ExpectSection() {
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
                What to expect.
              </h2>
              <p className="text-sand-500 mt-4 leading-relaxed">
                The Saturday run is open to all Essentia members. No sign-up
                needed: just show up at 7:30, ready to move.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {expects.map((e) => (
                <div key={e.number}>
                  <span className="font-display text-petroleum-500 text-5xl">
                    {e.number}
                  </span>
                  <h3 className="text-sand-100 mt-3 text-lg font-medium">
                    {e.title}
                  </h3>
                  <p className="text-sand-500 mt-2 text-sm leading-relaxed">
                    {e.description}
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
    <section ref={sectionRef} className="bg-sand-50 md:h-[220vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-16 text-center md:h-full md:justify-center md:py-20">
          <div ref={bodyRef} className="flex flex-col items-center gap-6">
            <h2 className="font-display text-petroleum-700 text-3xl text-balance md:text-4xl">
              See you Saturday.
            </h2>
            <p className="text-petroleum-400 max-w-md leading-relaxed">
              Running Club access is included with every Essentia membership.
              Choose your tier and join the community.
            </p>
            <Button variant="solid" size="md" href="/community/memberships">
              Join memberships
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function RunningClubSection() {
  return (
    <>
      <RunningClubHero />
      <NextRunSection />
      <ExpectSection />
      <CtaSection />
    </>
  );
}
