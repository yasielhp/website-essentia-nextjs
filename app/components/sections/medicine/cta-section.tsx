"use client";

import { useTranslations } from "next-intl";
import { Button } from "@components/ui/button";

/**
 * The page's closing call: book a session, or talk to us first. Memberships
 * are not on sale (the owner, 2026-11-24), so it no longer sends anyone there.
 */
export default function CtaSection() {
  const t = useTranslations("medicine.cta");

  return (
    <section className="bg-petroleum-700">
      <div className="overflow-hidden">
        <div className="mx-auto flex max-w-2xl flex-col items-center px-5 pt-24 pb-16 text-center md:py-20">
          <div className="flex flex-col items-center gap-6">
            <h2 className="font-display text-sand-50 text-3xl text-balance md:text-4xl">
              {t("heading")}
            </h2>
            <p className="text-sand-500 max-w-md leading-relaxed">
              {t("body")}
            </p>
            <div className="flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                variant="white"
                size="md"
                href="/booking?service=intravenous-therapy"
              >
                {t("ctaBook")}
              </Button>
              <Button variant="outline-white" size="md" href="/contact">
                {t("ctaContact")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
