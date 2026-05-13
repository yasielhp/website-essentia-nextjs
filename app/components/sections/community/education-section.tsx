"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Image from "next/image";
import { Calendar, Clock, Lock, Users } from "lucide-react";
import { Button } from "@components/ui/button";

gsap.registerPlugin(ScrollTrigger);

const sessionDetails = [
  { icon: Calendar, value: "Thursday, 5 June 2026" },
  { icon: Clock, value: "19:00 – 21:00" },
  { icon: Lock, value: "Members only" },
  { icon: Users, value: "Limited to 20 seats" },
];

const pillars = [
  {
    number: "I",
    title: "Expert speakers",
    description:
      "Each session features a researcher, clinician, or practitioner at the frontier of longevity science.",
  },
  {
    number: "II",
    title: "Practical takeaways",
    description:
      "Every talk closes with a set of protocols or habits you can apply the following week.",
  },
  {
    number: "III",
    title: "Open dialogue",
    description:
      "The second hour is reserved for Q&A and discussion. Bring your questions.",
  },
];

// ─── Hero ─────────────────────────────────────────────────────

function EducationHero() {
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
        src="/images/menu/education-programs.webp"
        alt="Essentia Education Programs"
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(9 33 33 / 0.6), rgb(9 33 33 / 0.78))",
        }}
      />
      <div ref={heroRef} className="relative mx-auto max-w-3xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          Education
          <br />
          Programs.
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          Monthly masterclasses with leading researchers, clinicians, and
          practitioners. Science you can use, delivered in person.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            onClick={() => {
              const el = document.getElementById("next-session");
              if (el) {
                const top = el.getBoundingClientRect().top + window.scrollY;
                window.scrollTo({ top, behavior: "smooth" });
                window.dispatchEvent(new CustomEvent("reveal-next-session"));
              }
            }}
          >
            Next session
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

// ─── Next session ─────────────────────────────────────────────

function NextSessionSection() {
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
    window.addEventListener("reveal-next-session", revealAll);

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
        tl.to(children[0], { opacity: 1, y: 0, duration: 0.2, ease: "power3.out" });
        tl.to(children[1], { opacity: 1, y: 0, duration: 0.4, ease: "power3.out" }, "-=0.05");
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1, y: 0, scale: 1, ease: "none",
              scrollTrigger: { trigger: child, start: "top 88%", end: "top 35%", scrub: 0.7 },
            },
          );
        });
      });
    }, sectionRef);

    return () => {
      ctx.revert();
      window.removeEventListener("reveal-next-session", revealAll);
    };
  }, []);

  return (
    <section ref={sectionRef} id="next-session" className="bg-sand-50 md:h-[280vh]">
      <div ref={innerRef} className="overflow-hidden md:h-screen">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:h-full md:justify-center md:pt-32 md:pb-16">
          <div ref={bodyRef} className="flex flex-col gap-8">
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                Next session.
              </h2>
              <p className="text-petroleum-400 mt-2 leading-relaxed">
                One evening a month. One topic that changes how you think about your health.
              </p>
            </div>

            <div className="bg-sand-100 grid grid-cols-1 overflow-hidden rounded-3xl md:grid-cols-2">
              <div className="relative h-56 md:h-auto md:min-h-72">
                <Image
                  src="/images/menu/education-programs.webp"
                  alt="Next Essentia masterclass"
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
              <div className="flex flex-col justify-between gap-6 p-8 md:p-10">
                <div className="flex flex-col gap-4">
                  <div>
                    <h3 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                      The Science
                      <br />
                      of Sleep.
                    </h3>
                    <p className="text-petroleum-400 mt-1 text-sm">
                      Dr. Elena Voss · Neuroscience & Recovery
                    </p>
                  </div>
                  <p className="text-petroleum-500 text-sm leading-relaxed">
                    Why sleep is the single highest-leverage intervention for
                    longevity, and what the latest research says about
                    optimising it for your biology.
                  </p>
                </div>

                <div className="border-sand-500 grid grid-cols-2 gap-4 border-t pt-6">
                  {sessionDetails.map(({ icon: Icon, value }) => (
                    <div key={value} className="flex items-start gap-2">
                      <Icon className="text-petroleum-400 mt-0.5 shrink-0" size={15} />
                      <p className="text-petroleum-600 text-sm leading-snug">{value}</p>
                    </div>
                  ))}
                </div>

                <Button
                  variant="solid"
                  size="md"
                  href="/community/education-programs/register"
                  className="w-full md:w-auto md:self-start"
                >
                  Reserve your seat
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Format ───────────────────────────────────────────────────

function FormatSection() {
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
        tl.to(children[0], { opacity: 1, y: 0, duration: 0.25, ease: "power3.out" });
        tl.to(children[1], { opacity: 1, y: 0, duration: 0.5, ease: "power3.out" }, "-=0.05");
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1, y: 0, scale: 1, ease: "none",
              scrollTrigger: { trigger: child, start: "top 88%", end: "top 35%", scrub: 0.7 },
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
                How it works.
              </h2>
              <p className="text-sand-500 mt-4 leading-relaxed">
                Each programme runs one evening per month at the Essentia
                club. Seats are limited and reserved for members.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {pillars.map((p) => (
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
        tl.to(children, { opacity: 1, y: 0, stagger: 0.15, duration: 0.35, ease: "power3.out" });
      });

      mm.add("(max-width: 767px)", () => {
        children.forEach((child) => {
          gsap.fromTo(
            child,
            { opacity: 0, y: 40, scale: 0.97 },
            {
              opacity: 1, y: 0, scale: 1, ease: "none",
              scrollTrigger: { trigger: child, start: "top 88%", end: "top 35%", scrub: 0.7 },
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
              Knowledge is the longest-lasting protocol.
            </h2>
            <p className="text-petroleum-400 max-w-md leading-relaxed">
              Education Programs are included with every Essentia membership.
              Choose your tier and reserve your seat.
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

export default function EducationSection() {
  return (
    <>
      <EducationHero />
      <NextSessionSection />
      <FormatSection />
      <CtaSection />
    </>
  );
}
