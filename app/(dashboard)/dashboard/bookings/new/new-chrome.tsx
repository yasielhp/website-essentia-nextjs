"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * The title, the two buttons, and where the error goes.
 *
 * Cancel and create appear twice — beside the title on a desk, across the
 * bottom on a phone — which is why they are here rather than as two unrelated
 * blocks at either end of the form.
 */
export function NewBookingHeader({
  submitting,
  error,
}: {
  submitting: boolean;
  error: string | null;
}) {
  const t = useTranslations("dashboard.bookings.form");
  const tCommon = useTranslations("dashboard.common");

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {t("title")}
        </h1>
        <div className="hidden items-center gap-3 sm:flex">
          <Button variant="outline" size="md" href="/dashboard/bookings">
            {tCommon("cancel")}
          </Button>
          <Button type="submit" variant="solid" size="md" disabled={submitting}>
            {submitting ? t("creating") : t("createBooking")}
          </Button>
        </div>
      </div>

      {error && (
        <p className="mb-6 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
    </>
  );
}

export function MobileCreateBar({ submitting }: { submitting: boolean }) {
  const t = useTranslations("dashboard.bookings.form");
  const tCommon = useTranslations("dashboard.common");

  return (
    <div className="mt-6 sm:hidden">
      <div className="grid grid-cols-2 gap-3">
        <Button
          variant="outline"
          size="md"
          href="/dashboard/bookings"
          className="w-full justify-center"
        >
          {tCommon("cancel")}
        </Button>
        <Button
          type="submit"
          variant="solid"
          size="md"
          disabled={submitting}
          className="w-full justify-center"
        >
          {submitting ? t("creating") : t("createBooking")}
        </Button>
      </div>
    </div>
  );
}
