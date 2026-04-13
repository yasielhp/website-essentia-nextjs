"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function BrandStatement() {
  const sectionRef = useRef<HTMLElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const titleRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const grid = gridRef.current;
    if (!section || !grid) return;

    const title = titleRef.current;
    const desc = descRef.current;

    const ctx = gsap.context(() => {
      const mm = gsap.matchMedia();

      // Desktop
      mm.add("(min-width: 768px)", () => {
        gsap.set(grid, {
          gridTemplateColumns: "0fr 1fr 1fr 1fr 0fr",
          gridTemplateRows: "0fr 1fr 1fr 1fr 0fr",
        });
        gsap.set([title, desc], { opacity: 0, y: 30 });

        const onUpdate = (self: ScrollTrigger) => {
          const p = self.progress;
          const theme = p > 0.85 ? "dark" : p > 0.5 ? "light" : "dark";
          section.dataset.headerTheme = theme;
        };

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: grid,
            onUpdate,
          },
        });

        tl.to(title, { opacity: 1, y: 0, ease: "power2.out", duration: 0.15 });
        tl.to(
          desc,
          { opacity: 1, y: 0, ease: "power2.out", duration: 0.15 },
          "<0.05",
        );

        tl.to(grid, {
          gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
          gridTemplateRows: "1fr 1fr 1fr 1fr 1fr",
          ease: "none",
          duration: 0.65,
        });

        tl.to(
          overlayRef.current,
          { opacity: 1, ease: "power1.in", duration: 0.15 },
          ">",
        );
      });

      // Mobile
      mm.add("(max-width: 767px)", () => {
        gsap.set(grid, { gridTemplateRows: "0fr 1fr 1fr 0fr" });
        gsap.set([title, desc], { opacity: 0, y: 30 });

        const onUpdate = (self: ScrollTrigger) => {
          const p = self.progress;
          const theme = p > 0.85 ? "dark" : p > 0.5 ? "light" : "dark";
          section.dataset.headerTheme = theme;
        };

        const tl = gsap.timeline({
          scrollTrigger: {
            trigger: section,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.6,
            pin: grid,
            onUpdate,
          },
        });

        tl.to(title, { opacity: 1, y: 0, ease: "power2.out", duration: 0.15 });
        tl.to(
          desc,
          { opacity: 1, y: 0, ease: "power2.out", duration: 0.15 },
          "<0.05",
        );

        tl.to(grid, {
          gridTemplateRows: "0.6fr 1fr 1fr 0.6fr",
          ease: "none",
          duration: 0.65,
        });

        tl.to(
          overlayRef.current,
          { opacity: 1, ease: "power1.in", duration: 0.15 },
          ">",
        );
      });
    }, section);

    return () => ctx.revert();
  }, []);

  return (
    <section
      ref={sectionRef}
      data-header-theme="dark"
      className="text-petroleum-700 h-[200vh]"
    >
      <div
        ref={gridRef}
        className="relative grid h-screen w-full grid-cols-2 md:grid-cols-5"
      >
        {/* Fade-out overlay */}
        <div
          ref={overlayRef}
          className="bg-sand-50 pointer-events-none absolute inset-0 z-10 opacity-0"
        />
        {/* Img 1 */}
        <div className="relative col-start-1 row-start-1 overflow-hidden md:row-span-2">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-1.webp"
            alt="Essentia wellness space"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 2 */}
        <div className="relative col-start-2 row-start-1 overflow-hidden md:col-start-1 md:row-span-3 md:row-start-3">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-2.webp"
            alt="Essentia treatment"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 3 */}
        <div className="relative col-start-1 row-start-4 overflow-hidden md:col-span-2 md:col-start-2 md:row-span-1 md:row-start-1">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-3.webp"
            alt="Essentia longevity protocol"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 4 — desktop only */}
        <div className="relative hidden overflow-hidden md:col-span-2 md:col-start-4 md:row-span-1 md:row-start-1 md:block">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-4.webp"
            alt="Essentia community"
            fill
            className="object-cover"
          />
        </div>

        {/* CENTER CONTENT */}
        <div className="col-span-2 row-span-2 row-start-2 flex flex-col items-center justify-center gap-5 px-6 py-10 text-center md:col-span-3 md:col-start-2 md:row-span-3 md:row-start-2 md:px-10">
          <p
            ref={titleRef}
            className="font-display text-3xl text-pretty md:max-w-lg md:text-4xl lg:text-5xl"
          >
            A longer life should also be a better one.
          </p>
          <p
            ref={descRef}
            className="text-petroleum-400 leading-relaxed text-pretty md:max-w-3xl"
          >
            Essentia brings together regenerative medicine, longevity protocols,
            and an exclusive community in one intentional space — rooted in
            Tenerife, designed for those who understand that how you live
            matters as much as how long.
          </p>
        </div>

        {/* Img 5 — desktop only */}
        <div className="relative hidden overflow-hidden md:col-start-5 md:row-span-4 md:row-start-2 md:block">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-5.webp"
            alt="Essentia Tenerife"
            fill
            className="object-cover"
          />
        </div>

        {/* Img 6 */}
        <div className="relative col-start-2 row-start-4 overflow-hidden md:col-span-3 md:col-start-2 md:row-span-1 md:row-start-5">
          <Image
            src="https://pub-7642190515d84a34b81f6b11e42e6c44.r2.dev/bento-img-6.webp"
            alt="Essentia wellness club"
            fill
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
