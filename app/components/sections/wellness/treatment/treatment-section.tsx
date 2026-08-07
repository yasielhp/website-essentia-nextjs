"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import type { TreatmentData } from "./data";
import { manualTherapyTreatments } from "@/data/services-data";

// ─── Hero ─────────────────────────────────────────────────────

function TreatmentHero({ data }: { data: TreatmentData }) {
  const t = useTranslations(`wellness.treatments.${data.slug}`);
  const tShared = useTranslations("wellness.treatments");
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
        src={data.heroImage}
        alt={t("heroAlt")}
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
      <div ref={heroRef} className="relative mx-auto max-w-5xl">
        <h1 className="font-display text-sand-50 text-5xl leading-tight tracking-tight text-balance md:text-7xl">
          {t("title")}
        </h1>
        <p className="text-sand-500 mx-auto mt-6 max-w-5xl leading-relaxed text-balance">
          {t("intro")}
        </p>
        {/* Only manual therapies has a second paragraph so far */}
        {t.has("intro2") && (
          <p className="text-sand-500 mx-auto mt-4 max-w-5xl leading-relaxed text-balance">
            {t("intro2")}
          </p>
        )}
        {data.slug === "manual-therapies" && (
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              variant="white"
              size="md"
              onClick={() => {
                const el = document.getElementById("treatments");
                if (el) {
                  const top =
                    el.getBoundingClientRect().top + window.scrollY - 80;
                  window.scrollTo({ top, behavior: "smooth" });
                }
              }}
            >
              {tShared("exploreTreatments")}
            </Button>
          </div>
        )}
      </div>
    </section>
  );
}

// ─── Manual Therapies — treatment grid ───────────────────────

function ManualTherapiesSection() {
  const t = useTranslations("wellness.treatments");

  const manualServices = manualTherapyTreatments;

  return (
    <section id="treatments" className="bg-sand-50 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            {t("manualTherapiesHeading")}
          </h2>
          <p className="text-petroleum-400 mx-auto mt-3 max-w-lg leading-relaxed">
            {t("manualTherapiesSubtitle")}
          </p>
        </div>

        {/* Said once here rather than on each treatment page */}
        <p className="border-sand-200 text-petroleum-500 mx-auto mb-12 max-w-2xl border-y py-6 text-center text-sm leading-relaxed">
          {t("aromaNote")}
        </p>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {manualServices.map((service) => (
            <Link
              key={service.id}
              href={`/wellness/manual-therapies/${service.id}`}
              className="group relative block h-80 cursor-pointer overflow-hidden rounded-2xl"
            >
              <Image
                src={service.image}
                alt={t(`manualTherapiesCards.${service.id}.title`)}
                fill
                sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
                className="object-cover transition-transform duration-500 group-hover:scale-105"
              />
              <div
                className="absolute inset-0"
                style={{
                  background:
                    "linear-gradient(to top, rgb(9 33 33 / 0.92), rgb(9 33 33 / 0.35), transparent)",
                }}
              />
              <span className="absolute top-4 right-4 text-xs text-white/60">
                {service.durations.join(" · ")}
              </span>
              <div className="absolute right-0 bottom-0 left-0 p-5">
                <h3 className="font-body text-lg text-white">
                  {t(`manualTherapiesCards.${service.id}.title`)}
                </h3>
                <p className="mt-1 text-sm leading-relaxed text-white/70">
                  {t(`manualTherapiesCards.${service.id}.description`)}
                </p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Benefits ─────────────────────────────────────────────────

function BenefitsSection({ data }: { data: TreatmentData }) {
  const t = useTranslations(`wellness.treatments.${data.slug}`);
  return (
    <section className="bg-sand-50">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12">
            <div className="md:max-w-lg">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("benefitsHeading")}
              </h2>
              <p className="text-petroleum-400 mt-4 leading-relaxed">
                {t("benefitsSubtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              {data.benefits.map((benefit, i) => (
                <div
                  key={benefit.title}
                  className="bg-sand-100 rounded-2xl p-6"
                >
                  <h3 className="text-petroleum-700 font-medium">
                    {t(`benefits.${i}.title`)}
                  </h3>
                  <p className="text-petroleum-500 mt-2 text-sm leading-relaxed">
                    {t(`benefits.${i}.description`)}
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

// ─── Session ──────────────────────────────────────────────────

function SessionSection({ data }: { data: TreatmentData }) {
  const t = useTranslations(`wellness.treatments.${data.slug}`);
  return (
    <section className="bg-petroleum-700">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12 md:gap-16">
            <div className="md:max-w-lg">
              <h2 className="font-display text-sand-50 text-3xl md:text-4xl">
                {t("sessionHeading")}
              </h2>
              <p className="text-sand-500 mt-4 leading-relaxed">
                {t("sessionSubtitle")}
              </p>
            </div>
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {data.sessionDetails.map((detail) => (
                <div key={detail.number}>
                  <span className="font-display text-petroleum-500 text-5xl">
                    {detail.number}
                  </span>
                  <h3 className="text-sand-100 mt-3 text-lg font-medium">
                    {t(`sessionDetails.${detail.number}.title`)}
                  </h3>
                  <p className="text-sand-500 mt-2 text-sm leading-relaxed">
                    {t(`sessionDetails.${detail.number}.description`)}
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

function CtaSection({ data }: { data: TreatmentData }) {
  const t = useTranslations(`wellness.treatments.${data.slug}`);
  const tShared = useTranslations("wellness.treatments");
  return (
    <section className="bg-sand-50">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-16 text-center md:py-20">
          <div className="flex flex-col items-center gap-6">
            <h2 className="font-display text-petroleum-700 text-3xl text-balance md:text-4xl">
              {t("ctaHeading")}
            </h2>
            <p className="text-petroleum-400 max-w-md leading-relaxed">
              {t("ctaBody")}
            </p>
            {data.slug === "manual-therapies" && (
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Button
                  variant="solid"
                  size="md"
                  href={`/booking?wellness=${data.slug}`}
                >
                  {tShared("bookSession")}
                </Button>
                <Button
                  variant="outline"
                  size="md"
                  href="/experiences/memberships"
                >
                  {tShared("viewMemberships")}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function TreatmentSection({ data }: { data: TreatmentData }) {
  return (
    <>
      <TreatmentHero data={data} />
      {data.slug === "manual-therapies" && <ManualTherapiesSection />}
      <BenefitsSection data={data} />
      <SessionSection data={data} />
      {data.slug !== "manual-therapies" && <CtaSection data={data} />}
    </>
  );
}
