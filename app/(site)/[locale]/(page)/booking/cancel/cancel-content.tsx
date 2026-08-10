"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import { CalendarX, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatBookingDate, type SupportedLocale } from "@/utils/format";
import {
  fetchCancellableBooking,
  cancelBookingByToken,
} from "@/actions/booking-cancellation";
import type { CancellableBooking } from "@/types/booking";

type Screen = "loading" | "confirm" | "done" | "late" | "already" | "missing";

export function CancelContent() {
  const t = useTranslations("booking.cancel");
  const locale = useLocale();
  const token = useSearchParams().get("token") ?? "";

  const [booking, setBooking] = useState<CancellableBooking | null>(null);
  const [screen, setScreen] = useState<Screen>("loading");
  const [working, setWorking] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (token ? fetchCancellableBooking(token) : Promise.resolve(null)).then(
      (result) => {
        if (cancelled) return;
        setBooking(result);
        setScreen(
          !result
            ? "missing"
            : result.alreadyCancelled
              ? "already"
              : result.cancellable
                ? "confirm"
                : "late",
        );
      },
    );
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleCancel() {
    setWorking(true);
    try {
      const result = await cancelBookingByToken(token, locale as "en" | "es");
      setScreen(
        result.ok
          ? "done"
          : result.reason === "too_late"
            ? "late"
            : result.reason === "already"
              ? "already"
              : "missing",
      );
    } finally {
      // Otherwise a failed call leaves the only button on the page disabled,
      // on a screen someone reached from an email to cancel an appointment.
      setWorking(false);
    }
  }

  const formattedDate = booking?.date
    ? formatBookingDate(booking.date.slice(0, 10), locale as SupportedLocale)
    : null;

  const copy: Record<
    Exclude<Screen, "loading">,
    { title: string; body: string }
  > = {
    confirm: { title: t("confirm.heading"), body: t("confirm.body") },
    done: { title: t("done.heading"), body: t("done.body") },
    late: { title: t("late.heading"), body: t("late.body") },
    already: { title: t("already.heading"), body: t("already.body") },
    missing: { title: t("missing.heading"), body: t("missing.body") },
  };

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center justify-center px-5 py-24">
      <div className="w-full max-w-md">
        {screen === "loading" ? (
          <div className="bg-sand-100 mx-auto h-40 w-full animate-pulse rounded-2xl" />
        ) : (
          <>
            <div className="bg-petroleum-700 mx-auto mb-8 flex size-16 items-center justify-center rounded-full">
              {screen === "done" ? (
                <Check className="text-sand-50" size={28} strokeWidth={2.5} />
              ) : (
                <CalendarX
                  className="text-sand-50"
                  size={28}
                  strokeWidth={2.5}
                />
              )}
            </div>

            <div className="mb-8 text-center">
              <h1 className="font-display text-petroleum-700 text-3xl md:text-4xl">
                {copy[screen].title}
              </h1>
              <p className="text-petroleum-400 mt-3 leading-relaxed text-balance">
                {copy[screen].body}
              </p>
            </div>

            {/* The booking being cancelled, so nobody cancels the wrong one. */}
            {booking && screen !== "missing" && (
              <div className="border-sand-200 divide-sand-100 mb-6 divide-y rounded-2xl border bg-white">
                {[
                  [
                    t("detail.service"),
                    booking.sessionType ?? booking.serviceTitle,
                  ],
                  [t("detail.date"), formattedDate],
                  [t("detail.time"), booking.time?.slice(0, 5) ?? null],
                ]
                  .filter(([, value]) => !!value)
                  .map(([label, value]) => (
                    <div
                      key={label}
                      className="flex items-center justify-between px-5 py-3.5"
                    >
                      <span className="text-petroleum-400 text-sm">
                        {label}
                      </span>
                      <span className="text-petroleum-700 text-sm font-medium">
                        {value}
                      </span>
                    </div>
                  ))}
              </div>
            )}

            <div className="flex flex-col items-center gap-3">
              {screen === "confirm" && (
                <Button
                  variant="solid"
                  size="lg"
                  onClick={() => void handleCancel()}
                  disabled={working}
                >
                  {working ? t("confirm.working") : t("confirm.action")}
                </Button>
              )}
              <Button variant="outline" size="md" href="/booking">
                {screen === "confirm" ? t("keep") : t("bookAgain")}
              </Button>
            </div>
          </>
        )}
      </div>
    </section>
  );
}
