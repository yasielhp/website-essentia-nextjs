"use client";

import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Button } from "@/components/ui/button";

export function RequestedContent() {
  const t = useTranslations("booking.requested");
  const locale = useLocale();
  const searchParams = useSearchParams();
  const service = searchParams.get("service") ?? "";
  const dateStr = searchParams.get("date");
  const time = searchParams.get("time") ?? "";
  const phone = searchParams.get("phone") ?? "";

  const dateIso = dateStr?.split("T")[0];
  const date = dateIso ? new Date(`${dateIso}T12:00:00`) : null;
  const dateLocale = locale === "es" ? "es-ES" : "en-GB";
  const formattedDate = date
    ? date.toLocaleDateString(dateLocale, {
        weekday: "long",
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : null;

  const hasDetails = service || formattedDate || time;

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center justify-center px-5 py-24">
      <div className="w-full max-w-md">
        {/* Icon */}
        <div className="bg-petroleum-700 mx-auto mb-8 flex size-16 items-center justify-center rounded-full">
          <Clock className="text-sand-50" size={28} strokeWidth={2.5} />
        </div>

        {/* Heading */}
        <div className="mb-8 text-center">
          <h1 className="font-display text-petroleum-700 text-3xl md:text-4xl">
            {t("heading")}
          </h1>
          <p className="text-petroleum-400 mt-3 leading-relaxed text-balance">
            {t("body")}
          </p>
        </div>

        {/* Detail card */}
        {hasDetails && (
          <div className="border-sand-200 divide-sand-100 mb-6 divide-y rounded-2xl border bg-white">
            {service && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-petroleum-400 text-sm">
                  {t("detail.service")}
                </span>
                <span className="text-petroleum-700 text-sm font-medium">
                  {service}
                </span>
              </div>
            )}
            {formattedDate && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-petroleum-400 text-sm">
                  {t("detail.date")}
                </span>
                <span className="text-petroleum-700 text-sm font-medium">
                  {formattedDate}
                </span>
              </div>
            )}
            {time && (
              <div className="flex items-center justify-between px-5 py-3.5">
                <span className="text-petroleum-400 text-sm">
                  {t("detail.time")}
                </span>
                <span className="text-petroleum-700 text-sm font-medium">
                  {time}
                </span>
              </div>
            )}
          </div>
        )}

        {/* Contact note */}
        <p className="text-petroleum-400 mb-8 text-center text-sm leading-relaxed">
          {phone
            ? t.rich("contactNoteWithPhone", {
                phoneValue: phone,
                phone: (chunks) => (
                  <span className="text-petroleum-600 font-medium">
                    {chunks}
                  </span>
                ),
              })
            : t("contactNote")}
        </p>

        {/* CTA */}
        <Button variant="solid" size="md" href="/" className="w-full">
          {t("cta")}
        </Button>
      </div>
    </section>
  );
}
