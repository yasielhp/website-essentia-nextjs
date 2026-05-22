"use client";

import { Check } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Button } from "@components/ui/button";
import type { BookableService } from "@/data/services-data";

export function SuccessState({
  service,
  date,
  time,
  phone,
}: {
  service: BookableService;
  date: Date;
  time: string;
  phone: string;
}) {
  const t = useTranslations("booking.successState");
  const locale = useLocale();
  const dateLocale = locale === "es" ? "es-ES" : "en-GB";
  const formattedDate = date.toLocaleDateString(dateLocale, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col items-center gap-6 py-16 text-center">
      <div className="bg-petroleum-700 flex size-16 items-center justify-center rounded-full">
        <Check className="text-sand-50" size={28} />
      </div>
      <div className="flex flex-col gap-2">
        <h2 className="font-display text-petroleum-700 text-3xl">
          {t("heading")}
        </h2>
        <p className="text-petroleum-500 text-balance">
          {t("body", { service: service.title, date: formattedDate, time })}
        </p>
        <p className="text-petroleum-400 mt-1 text-sm text-balance">
          {t.rich("contactNote", {
            phone,
            strong: (chunks) => (
              <span className="text-petroleum-500 font-medium">{chunks}</span>
            ),
          })}
        </p>
      </div>
      <Button variant="solid" size="md" href="/">
        {t("cta")}
      </Button>
    </div>
  );
}
