"use client";

import { useRef, useEffect } from "react";
import gsap from "gsap";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import type { TreatmentData } from "./data";
import {
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";

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
              className="w-full md:w-auto"
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

/**
 * Each card's price is its session type's, the one the booking form shows and
 * charges, not a figure kept in code: the centre changes its prices itself.
 * The page reads them on the server and hands in each card's line as text
 * (`cardLines`), so the price is in the HTML the card arrives with. A
 * treatment whose session type is not on sale in the length the card says
 * shows its length alone; so does every card when the read failed. One whose
 * session type the centre switched off has no card at all while it is off
 * (`hidden`), and is back on the list when it is switched on again.
 */
function ManualTherapiesSection({
  lines,
  hidden,
}: {
  lines: Record<string, string>;
  hidden: readonly string[];
}) {
  const t = useTranslations("wellness.treatments");

  const manualServices = manualTherapyTreatments.filter(
    (treatment) => !hidden.includes(treatment.id),
  );

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

        <div className="flex flex-col gap-4">
          {manualServices.map((service) => (
            <article
              key={service.id}
              className="bg-sand-100 grid overflow-hidden rounded-2xl md:grid-cols-2"
            >
              {/* Copy left, photo right — on mobile the photo leads */}
              <div className="order-2 flex flex-col items-start justify-center gap-3 p-6 md:order-1 md:p-8">
                <div>
                  <h3 className="font-display text-petroleum-700 text-xl md:text-2xl">
                    {t(`manualTherapiesCards.${service.id}.title`)}
                  </h3>
                  {/* Duration and price on one line, as the facial cards
                      write theirs: "30 min · 70 €". With no price to show it
                      is the duration alone, as the card always was. */}
                  <span className="text-petroleum-400 mt-1 block text-xs tracking-wider uppercase">
                    {lines[service.id] ?? service.durations.join(" · ")}
                  </span>
                </div>

                <p className="text-petroleum-500 text-sm leading-relaxed">
                  {t(`manualTherapiesCards.${service.id}.description`)}
                </p>

                <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <Button
                    variant="solid"
                    size="sm"
                    href={`/booking?service=manual-therapies&treatment=${service.id}`}
                    className="w-full md:w-auto"
                  >
                    {t("bookSession")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    href={`/wellness/manual-therapies/${service.id}`}
                    className="w-full md:w-auto"
                  >
                    {t("viewTreatment")}
                  </Button>
                </div>
              </div>

              <div className="relative order-1 h-56 md:order-2 md:h-full md:min-h-64">
                <Image
                  src={service.thumbnail}
                  alt={t(`manualTherapiesCards.${service.id}.title`)}
                  fill
                  sizes="(max-width: 767px) 100vw, 448px"
                  className="object-cover"
                />
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Facial therapies — ritual list ──────────────────────────

/**
 * The IV protocols, as cards.
 *
 * A grid rather than the facials' one-per-row layout: there are twelve of
 * them, and stacked full-width rows would turn the page into a scroll. Each
 * card deep-links into the booking form with its own tier.
 */
function IvProtocolsSection({ hidden }: { hidden: readonly string[] }) {
  const t = useTranslations("medicine.iv");
  const protocols = ivProtocols.filter(
    (protocol) => !hidden.includes(protocol.id),
  );

  return (
    <section id="protocols" className="bg-sand-50 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <p className="text-petroleum-400 text-xs tracking-[0.2em] uppercase">
            {t("eyebrow")}
          </p>
          <h2 className="font-display text-petroleum-700 mt-3 text-3xl md:text-4xl">
            {t("heading")}
          </h2>
          <p className="text-petroleum-400 mx-auto mt-3 max-w-lg leading-relaxed">
            {t("subtitle")}
          </p>
        </div>

        {/* Same card as the manual therapies and the facial rituals: copy on
            one side, photo on the other. Twelve of them make a long page, and
            that is the trade for a card that can hold a real description. */}
        <div className="flex flex-col gap-4">
          {protocols.map((protocol) => (
            <article
              key={protocol.id}
              className="bg-sand-100 grid overflow-hidden rounded-2xl md:grid-cols-2"
            >
              <div className="order-2 flex flex-col items-start justify-center gap-3 p-6 md:order-1 md:p-8">
                <div>
                  <h3 className="font-display text-petroleum-700 text-xl md:text-2xl">
                    {t(`protocols.${protocol.id}.title`)}
                  </h3>
                  <span className="text-petroleum-400 mt-1 block text-xs tracking-wider uppercase">
                    {t(`protocols.${protocol.id}.meta`)}
                  </span>
                </div>

                <p className="text-petroleum-500 text-sm leading-relaxed">
                  {t(`protocols.${protocol.id}.description`)}
                </p>

                <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <Button
                    variant="solid"
                    size="sm"
                    href={`/booking?service=intravenous-therapy&treatment=${protocol.id}`}
                    className="w-full md:w-auto"
                  >
                    {t("book")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    href={`/medicine/intravenous-therapy/${protocol.id}`}
                    className="w-full md:w-auto"
                  >
                    {t("view")}
                  </Button>
                </div>
              </div>

              <div className="relative order-1 h-56 md:order-2 md:h-full md:min-h-64">
                <Image
                  src={protocol.thumbnail}
                  alt={t(`protocols.${protocol.id}.title`)}
                  fill
                  sizes="(max-width: 767px) 100vw, 50vw"
                  className="object-cover"
                />
              </div>
            </article>
          ))}
        </div>

        <p className="text-petroleum-400 mt-10 text-center text-xs leading-relaxed">
          {t("disclaimer")}
        </p>
      </div>
    </section>
  );
}

/**
 * As on the manual therapies: the price is the session type's, read by the
 * page on the server, not a figure typed into a translation, which went on
 * saying the old one after the centre changed it.
 */
function FacialTreatmentsSection({
  lines,
  hidden,
}: {
  lines: Record<string, string>;
  hidden: readonly string[];
}) {
  const t = useTranslations("wellness.treatments");
  const facials = facialTreatments.filter(
    (facial) => !hidden.includes(facial.id),
  );

  return (
    <section id="treatments" className="bg-sand-50 px-5 py-20 md:py-28">
      <div className="mx-auto max-w-4xl">
        <div className="mb-12 text-center">
          <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            {t("facialsHeading")}
          </h2>
          <p className="text-petroleum-400 mx-auto mt-3 max-w-lg leading-relaxed">
            {t("facialsSubtitle")}
          </p>
        </div>

        <div className="flex flex-col gap-4">
          {facials.map((facial) => (
            <article
              key={facial.id}
              className="bg-sand-100 grid overflow-hidden rounded-2xl md:grid-cols-2"
            >
              <div className="order-2 flex flex-col items-start justify-center gap-3 p-6 md:order-1 md:p-8">
                <div>
                  <h3 className="font-display text-petroleum-700 text-xl md:text-2xl">
                    {t(`facialCards.${facial.id}.title`)}
                  </h3>
                  {/* A ritual with a length shows it and the price of its
                      session type; one without prints the line written for
                      it (see `FacialTreatment.durations`). */}
                  <span className="text-petroleum-400 mt-1 block text-xs tracking-wider uppercase">
                    {facial.durations
                      ? (lines[facial.id] ?? facial.durations.join(" · "))
                      : t(`facialCards.${facial.id}.meta`)}
                  </span>
                </div>

                <p className="text-petroleum-500 text-sm leading-relaxed">
                  {t(`facialCards.${facial.id}.description`)}
                </p>

                {/* Each ritual opens the booking form on its own session
                    type, found by its name. One whose session type is switched
                    off has no card here (`hidden`); an old link to it lands on
                    the list of the others, with none chosen. */}
                <div className="mt-2 flex w-full flex-col gap-2 sm:flex-row md:w-auto">
                  <Button
                    variant="solid"
                    size="sm"
                    href={`/booking?service=facial-therapies&treatment=${facial.id}`}
                    className="w-full md:w-auto"
                  >
                    {t("bookSession")}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    href={`/wellness/facial-therapies/${facial.id}`}
                    className="w-full md:w-auto"
                  >
                    {t("viewTreatment")}
                  </Button>
                </div>
              </div>

              <div className="relative order-1 h-56 md:order-2 md:h-full md:min-h-64">
                <Image
                  src={facial.thumbnail}
                  alt={t(`facialCards.${facial.id}.title`)}
                  fill
                  sizes="(max-width: 767px) 100vw, 448px"
                  className="object-cover"
                />
              </div>
            </article>
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
    // White, so the break from the treatments list above reads as a new section
    <section className="bg-white">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12">
            <div>
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

/**
 * A step that names a treatment (`mentions`) says it only while that treatment
 * is on the site: while its session type is switched off (`hidden`) the step
 * reads the same text without it (`descriptionWithout`).
 */
function SessionSection({
  data,
  hidden,
}: {
  data: TreatmentData;
  hidden: readonly string[];
}) {
  const t = useTranslations(`wellness.treatments.${data.slug}`);
  return (
    <section className="bg-petroleum-700">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12 md:gap-16">
            <div>
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
                    {t(
                      detail.mentions?.some((id) => hidden.includes(id))
                        ? `sessionDetails.${detail.number}.descriptionWithout`
                        : `sessionDetails.${detail.number}.description`,
                    )}
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

// ─── Page ─────────────────────────────────────────────────────

export default function TreatmentSection({
  data,
  cardLines = {},
  hiddenIds = [],
}: {
  data: TreatmentData;
  /**
   * The line under each card's title (length and price), by treatment id, as
   * the page made it on the server (`cardLines`). None for a page whose cards
   * take no price from the database.
   */
  cardLines?: Record<string, string>;
  /**
   * The treatments whose session type is switched off in Settings, which get
   * no card while it is off (`listHiddenTreatments`, read by the page on the
   * server). Empty when the read failed: then every card is shown.
   */
  hiddenIds?: readonly string[];
}) {
  return (
    <>
      <TreatmentHero data={data} />
      {data.slug === "manual-therapies" && (
        <ManualTherapiesSection lines={cardLines} hidden={hiddenIds} />
      )}
      {data.slug === "facial-therapies" && (
        <FacialTreatmentsSection lines={cardLines} hidden={hiddenIds} />
      )}
      {data.slug === "intravenous-therapy" && (
        <IvProtocolsSection hidden={hiddenIds} />
      )}
      <BenefitsSection data={data} />
      <SessionSection data={data} hidden={hiddenIds} />
    </>
  );
}
