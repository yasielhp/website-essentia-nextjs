"use client";

import Image from "next/image";
import { CreditCard, Store } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import type { BookableService } from "@/data/services-data";
import {
  facialTreatments,
  manualTherapyTreatments,
} from "@/data/services-data";
import type { DetailsState } from "@/types";
import {
  ONLINE_PAYMENT_DISCOUNT_PERCENT,
  onlineDiscountAmount,
  onlinePrice,
} from "@/lib/pricing";

export type PaymentMethod = "online" | "on-site";

/**
 * Finds the treatment behind the chosen tier.
 *
 * Tiers live in the database and carry a label but no description or photo of
 * their own, while the treatment copy is translated and lives in the messages.
 * The two meet on the title, which is what the tier label is set to.
 */
function treatmentByLabel(label: string | null) {
  if (!label) return null;
  const all = [...manualTherapyTreatments, ...facialTreatments];
  return all.find((t) => t.title.toLowerCase() === label.toLowerCase()) ?? null;
}

export function ConfirmStep({
  service,
  tierLabel,
  duration,
  price,
  date,
  time,
  details,
  therapistGender,
  paymentMethod,
  onPaymentMethodChange,
}: {
  service: BookableService;
  tierLabel: string | null;
  duration: string;
  price: number | null;
  date: Date | null;
  time: string | null;
  details: DetailsState;
  therapistGender?: "male" | "female" | null;
  paymentMethod: PaymentMethod;
  onPaymentMethodChange: (method: PaymentMethod) => void;
}) {
  const t = useTranslations("booking.confirmStep");
  const tt = useTranslations("booking.durationStep");
  const tCards = useTranslations("wellness.treatments");
  const tServices = useTranslations("booking.serviceStep");
  const locale = useLocale();
  const dateLocale = locale === "es" ? "es-ES" : "en-GB";

  const treatment = treatmentByLabel(tierLabel);
  const cardKey = treatment
    ? manualTherapyTreatments.some((m) => m.id === treatment.id)
      ? `manualTherapiesCards.${treatment.id}`
      : `facialCards.${treatment.id}`
    : null;

  const heading = tierLabel ?? service.title;
  const summary =
    cardKey && tCards.has(`${cardKey}.description`)
      ? tCards(`${cardKey}.description`)
      : null;
  const image = treatment?.thumbnail ?? service.image;

  const discount = price != null ? onlineDiscountAmount(price) : null;
  const finalPrice =
    price != null
      ? paymentMethod === "online"
        ? onlinePrice(price)
        : price
      : null;

  const methods: {
    id: PaymentMethod;
    icon: typeof CreditCard;
    title: string;
    note: string;
  }[] = [
    {
      id: "online",
      icon: CreditCard,
      title: t("payOnline"),
      note:
        ONLINE_PAYMENT_DISCOUNT_PERCENT > 0
          ? t("payOnlineNote", { percent: ONLINE_PAYMENT_DISCOUNT_PERCENT })
          : t("payOnlineNoteNoDiscount"),
    },
    {
      id: "on-site",
      icon: Store,
      title: t("payOnSite"),
      note: t("payOnSiteNote"),
    },
  ];

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-5 rounded-2xl bg-white p-6">
        <p className="text-petroleum-400 text-xs tracking-wider uppercase">
          {tServices(`services.${service.id}.title`)}
        </p>

        {/* The treatment, not the service it belongs to */}
        <div className="flex items-start gap-4">
          <div className="relative size-16 shrink-0 overflow-hidden rounded-xl">
            <Image
              src={image}
              alt={heading}
              fill
              sizes="64px"
              className="object-cover"
            />
          </div>
          <div>
            <p className="text-petroleum-700 font-medium">{heading}</p>
            {summary && (
              <p className="text-petroleum-400 mt-1 text-sm leading-relaxed">
                {summary}
              </p>
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
            ...(therapistGender
              ? [
                  {
                    label: tt("therapistLabel"),
                    value:
                      therapistGender === "male"
                        ? tt("therapistMale")
                        : tt("therapistFemale"),
                  },
                ]
              : []),
          ].map(({ label, value }) => (
            <div key={label}>
              <p className="text-petroleum-400 text-xs">{label}</p>
              <p className="text-petroleum-700 text-sm">{value}</p>
            </div>
          ))}
        </div>

        {/* What it costs */}
        <div className="border-sand-100 flex flex-col gap-2 border-t pt-4">
          {duration && (
            <div className="flex items-baseline justify-between text-sm">
              <span className="text-petroleum-400">{t("durationLabel")}</span>
              <span className="text-petroleum-700">{duration}</span>
            </div>
          )}
          {price != null && (
            <>
              <div className="flex items-baseline justify-between text-sm">
                <span className="text-petroleum-400">{t("priceLabel")}</span>
                <span className="text-petroleum-700">€{price}</span>
              </div>
              {/* Only when there is a discount to show */}
              {discount != null && discount > 0 && (
                <div className="flex items-baseline justify-between text-sm">
                  <span className="text-petroleum-400">
                    {t("discountLabel")}
                  </span>
                  <span
                    className={
                      paymentMethod === "online"
                        ? "text-red-600"
                        : "text-petroleum-400"
                    }
                  >
                    {paymentMethod === "online" ? `−€${discount}` : "—"}
                  </span>
                </div>
              )}
              <div className="border-sand-100 flex items-baseline justify-between border-t pt-2">
                <span className="text-petroleum-700 font-medium">
                  {t("totalLabel")}
                </span>
                <span className="font-display text-petroleum-700 text-xl">
                  €{finalPrice}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* How they want to pay */}
      <div className="flex flex-col gap-3 rounded-2xl bg-white p-6">
        <p className="text-petroleum-700 text-sm font-medium">
          {t("paymentHeading")}
        </p>
        <div className="flex flex-col gap-3">
          {methods.map(({ id, icon: Icon, title, note }) => {
            const selected = paymentMethod === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => onPaymentMethodChange(id)}
                aria-pressed={selected}
                className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition-colors ${
                  selected
                    ? "border-petroleum-700 bg-sand-50"
                    : "border-sand-200 hover:border-sand-500"
                }`}
              >
                <Icon
                  size={16}
                  className="text-petroleum-400 mt-0.5 shrink-0"
                />
                <span>
                  <span className="text-petroleum-700 block text-sm font-medium">
                    {title}
                  </span>
                  <span className="text-petroleum-500 mt-0.5 block text-sm leading-relaxed">
                    {note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>

        <p className="text-petroleum-400 text-xs leading-relaxed">
          {t("cancellationNote")}
        </p>
      </div>
    </div>
  );
}
