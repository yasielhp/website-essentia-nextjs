"use client";

import Image from "next/image";
import { Phone } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { BookableService } from "@/data/services-data";
import type { DetailsState } from "@/types";

export function ConfirmStep({
  service,
  duration,
  price,
  date,
  time,
  details,
}: {
  service: BookableService;
  duration: string;
  price: number | null;
  date: Date | null;
  time: string | null;
  details: DetailsState;
}) {
  const t = useTranslations("booking.confirmStep");
  const locale = useLocale();
  const dateLocale = locale === "es" ? "es-ES" : "en-GB";
  const priceLine = [duration || null, price != null ? `€${price}` : null]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 rounded-2xl bg-white p-6">
        {/* Service */}
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
            <Image
              src={service.image}
              alt={service.title}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-petroleum-700 font-medium">{service.title}</p>
            {priceLine && (
              <p className="text-petroleum-400 text-sm">{priceLine}</p>
            )}
          </div>
        </div>

        {/* Booking details */}
        <div className="border-sand-100 grid gap-3 border-t pt-4 md:grid-cols-2">
          {[
            {
              label: t("date"),
              value: date
                ? date.toLocaleDateString(dateLocale, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : t("toBeConfirmed"),
            },
            { label: t("time"), value: time ?? t("toBeConfirmed") },
            {
              label: t("name"),
              value: `${details.firstName} ${details.lastName}`,
            },
            { label: t("email"), value: details.email },
            { label: t("phone"), value: details.phone },
            { label: t("location"), value: t("atTheCenter") },
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-petroleum-400 text-xs">{label}</p>
              <p className="text-petroleum-700 text-sm">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Payment & confirmation notice */}
      <div className="border-sand-200 flex items-start gap-3 rounded-2xl border bg-white p-5">
        <Phone size={16} className="text-petroleum-400 mt-0.5 shrink-0" />
        <p className="text-petroleum-500 text-sm leading-relaxed">
          {t("paymentNoticePrefix")}{" "}
          <strong className="text-petroleum-700 font-medium">
            {t("channel")}
          </strong>{" "}
          {t("paymentNoticeAt")}{" "}
          <span className="font-medium">{details.phone}</span>{" "}
          {t("paymentNoticeSuffix")}
        </p>
      </div>
    </div>
  );
}
