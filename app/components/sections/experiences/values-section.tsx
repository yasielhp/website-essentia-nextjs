"use client";

import { useTranslations } from "next-intl";
import { valueKeys, valueNumbers } from "./data";

export default function ValuesSection() {
  const t = useTranslations("experiences.values");

  return (
    <section className="bg-sand-100">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-4xl flex-col px-5 pt-24 pb-16 md:py-20">
          <div className="flex flex-col gap-12 md:gap-16">
            {/* ── Header ── */}
            <div className="md:max-w-lg">
              <h2 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {t("heading")}
                <br />
                {t("headingBreak")}
              </h2>
              <p className="text-petroleum-400 mt-4 leading-relaxed">
                {t("body")}
              </p>
            </div>

            {/* ── Values ── */}
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              {valueKeys.map((k) => (
                <div key={k}>
                  <span className="font-display text-petroleum-200 text-5xl">
                    {valueNumbers[k]}
                  </span>
                  <h3 className="text-petroleum-700 mt-3 text-lg font-medium">
                    {t(`items.${k}.title`)}
                  </h3>
                  <p className="text-petroleum-400 mt-2 text-sm leading-relaxed">
                    {t(`items.${k}.description`)}
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
