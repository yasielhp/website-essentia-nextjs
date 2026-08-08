"use client";

import { useRef, useEffect } from "react";
import Image from "next/image";
import gsap from "gsap";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import type { ManualTherapyTreatment } from "@/data/services-data";

// ─── Hero ─────────────────────────────────────────────────────

function ServiceHero({ service }: { service: ManualTherapyTreatment }) {
  const t = useTranslations("wellness.treatments.serviceDetail");
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
        src={service.image}
        alt={service.title}
        fill
        priority
        sizes="100vw"
        className="object-cover"
      />
      <div
        className="absolute inset-0"
        style={{
          background:
            "linear-gradient(to bottom, rgb(9 33 33 / 0.45), rgb(9 33 33 / 0.82))",
        }}
      />
      <div ref={heroRef} className="relative mx-auto max-w-3xl">
        {/* Optional: only treatments with a protocol name carry these */}
        {t.has(`${service.id}.eyebrow`) && (
          <p className="text-sand-500 mb-4 text-xs tracking-[0.25em] uppercase">
            {t(`${service.id}.eyebrow`)}
          </p>
        )}
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          {t(`${service.id}.title`)}
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-xl leading-relaxed text-balance">
          {t(`${service.id}.description`)}
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Button
            variant="white"
            size="md"
            href={`/booking?service=manual-therapies&treatment=${service.id}`}
          >
            {t("bookSession")}
          </Button>
          <Button
            variant="outline-white"
            size="md"
            onClick={() => {
              const el = document.getElementById("details");
              if (el) {
                const top =
                  el.getBoundingClientRect().top + window.scrollY - 80;
                window.scrollTo({ top, behavior: "smooth" });
              }
            }}
          >
            {t("learnMore")}
          </Button>
        </div>
      </div>
    </section>
  );
}

// ─── Details ──────────────────────────────────────────────────

function ServiceDetails({ service }: { service: ManualTherapyTreatment }) {
  const t = useTranslations("wellness.treatments.serviceDetail");
  return (
    <section id="details" className="bg-sand-50">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12">
            {/* Body text */}
            <div>
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("aboutHeading")}
              </h2>
              {/* Paragraphs are separated by a blank line in the message */}
              <div className="mt-6 flex flex-col gap-4">
                {t(`${service.id}.body`)
                  .split(/\n{2,}/)
                  .map((paragraph, i) => (
                    <p key={i} className="text-petroleum-500 leading-relaxed">
                      {paragraph}
                    </p>
                  ))}
              </div>
            </div>

            {/* Highlights grid */}
            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {service.highlights.map((_, i) => (
                <div key={i} className="bg-sand-100 rounded-2xl p-6">
                  <h3 className="text-petroleum-700 font-medium">
                    {t(`${service.id}.highlights.${i}.title`)}
                  </h3>
                  <p className="text-petroleum-500 mt-2 text-sm leading-relaxed">
                    {t(`${service.id}.highlights.${i}.description`)}
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

function ServiceCta({ service }: { service: ManualTherapyTreatment }) {
  const t = useTranslations("wellness.treatments.serviceDetail");
  return (
    <section className="bg-petroleum-700">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-16 text-center md:py-20">
          <div className="flex flex-col items-center gap-6">
            <h2 className="font-display text-sand-50 text-3xl text-balance md:text-4xl">
              {t("ctaHeading")}
            </h2>
            <p className="text-sand-500 max-w-md leading-relaxed">
              {t("ctaBody", { service: t(`${service.id}.title`) })}
            </p>
            <div className="flex flex-col items-center gap-3 sm:flex-row">
              <Button
                variant="white"
                size="md"
                href={`/booking?service=manual-therapies&treatment=${service.id}`}
              >
                {t("bookSession")}
              </Button>
              <Button
                variant="outline-white"
                size="md"
                href="/wellness/manual-therapies#treatments"
              >
                {t("viewAll")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page view ────────────────────────────────────────────────

export function ServiceDetailView({
  service,
}: {
  service: ManualTherapyTreatment;
}) {
  return (
    <>
      <ServiceHero service={service} />
      <ServiceDetails service={service} />
      <ServiceCta service={service} />
    </>
  );
}
