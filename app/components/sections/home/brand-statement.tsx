"use client";

import Image from "next/image";
import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function BrandStatement() {
  const t = useTranslations("home.brandStatement");
  const titleRef = useRef<HTMLParagraphElement>(null);
  const descRef = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    const title = titleRef.current;
    const desc = descRef.current;
    if (!title || !desc) return;

    const ctx = gsap.context(() => {
      gsap.from([title, desc], {
        opacity: 0,
        y: 30,
        duration: 0.7,
        ease: "power3.out",
        stagger: 0.1,
        scrollTrigger: { trigger: title, start: "top 85%", once: true },
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <section className="text-petroleum-700 bg-sand-100">
      <div className="relative grid h-screen w-full grid-cols-2 md:grid-cols-5">
        {/* Img 1 */}
        <div className="relative col-start-1 row-start-1 overflow-hidden md:row-span-2">
          <Image
            src="/images/home/bento-img-1-v3.webp"
            alt="Essentia wellness space"
            fill
            sizes="(max-width: 767px) 50vw, 20vw"
            className="object-cover"
          />
        </div>

        {/* Img 2 */}
        <div className="relative col-start-2 row-start-1 overflow-hidden md:col-start-1 md:row-span-3 md:row-start-3">
          <Image
            src="/images/home/bento-img-2-v3.webp"
            alt="Essentia treatment"
            fill
            sizes="(max-width: 767px) 50vw, 20vw"
            className="object-cover"
          />
        </div>

        {/* Img 3 */}
        <div className="relative col-start-1 row-start-4 overflow-hidden md:col-span-2 md:col-start-2 md:row-span-1 md:row-start-1">
          <Image
            src="/images/home/bento-img-3-v3.webp"
            alt="Essentia longevity protocol"
            fill
            sizes="(max-width: 767px) 50vw, 40vw"
            className="object-cover"
          />
        </div>

        {/* Img 4 — desktop only */}
        <div className="relative hidden overflow-hidden md:col-span-2 md:col-start-4 md:row-span-1 md:row-start-1 md:block">
          <Image
            src="/images/home/bento-img-4-v3.webp"
            alt="Essentia community"
            fill
            sizes="40vw"
            className="object-cover"
          />
        </div>

        {/* CENTER CONTENT */}
        <div className="col-span-2 row-span-2 row-start-2 flex flex-col items-center justify-center gap-5 px-6 py-10 text-center md:col-span-3 md:col-start-2 md:row-span-3 md:row-start-2 md:px-10">
          <p
            ref={titleRef}
            className="font-display text-3xl text-pretty md:max-w-lg md:text-4xl lg:text-5xl"
          >
            {t("headline")}
          </p>
          <p
            ref={descRef}
            className="text-petroleum-400 leading-relaxed text-pretty md:max-w-3xl"
          >
            {t("body")}
          </p>
        </div>

        {/* Img 5 — desktop only */}
        <div className="relative hidden overflow-hidden md:col-start-5 md:row-span-4 md:row-start-2 md:block">
          <Image
            src="/images/home/bento-img-5-v3.webp"
            alt="Essentia Tenerife"
            fill
            sizes="20vw"
            className="object-cover"
          />
        </div>

        {/* Img 6 */}
        <div className="relative col-start-2 row-start-4 overflow-hidden md:col-span-3 md:col-start-2 md:row-span-1 md:row-start-5">
          <Image
            src="/images/home/bento-img-6-v3.webp"
            alt="Essentia wellness club"
            fill
            sizes="(max-width: 767px) 50vw, 60vw"
            className="object-cover"
          />
        </div>
      </div>
    </section>
  );
}
