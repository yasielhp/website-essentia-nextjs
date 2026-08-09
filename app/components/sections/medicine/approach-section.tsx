"use client";

import { useTranslations } from "next-intl";
import { principles } from "./data";

export default function ApproachSection() {
  const t = useTranslations("medicine.approach");

  return (
    <section className="bg-sand-100">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12 md:gap-16">
            {/* ── Header ── */}
            <div className="md:max-w-lg">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("headingLine1")}
                <br />
                {t("headingLine2")}
              </h2>
              <p className="text-petroleum-400 mt-4 leading-relaxed">
                {t("body")}
              </p>
            </div>

            {/* ── Principles ── */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {principles.map((p) => (
                <div key={p.number}>
                  <span className="font-display text-petroleum-200 text-5xl">
                    {p.number}
                  </span>
                  <h3 className="text-petroleum-700 mt-3 text-lg font-medium">
                    {t(`principles.${p.number}.title`)}
                  </h3>
                  <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                    {t(`principles.${p.number}.description`)}
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
