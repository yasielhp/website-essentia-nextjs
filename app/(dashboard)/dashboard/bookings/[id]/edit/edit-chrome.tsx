"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

/**
 * The title, the two buttons, and where the error goes.
 *
 * Save appears twice — beside the title on a desk, across the bottom on a
 * phone — and so does the error, which is why both live here rather than as two
 * unrelated blocks at either end of the form.
 */
export function EditHeader({
  loading,
  submitting,
  error,
  onDelete,
}: {
  loading: boolean;
  submitting: boolean;
  error: string | null;
  onDelete: () => void;
}) {
  const t = useTranslations("dashboard.bookings.edit");

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="font-display text-petroleum-700 text-3xl">
          {t("title")}
        </h1>
        {/* Desktop buttons */}
        <div className="hidden items-center gap-3 sm:flex">
          <Button
            type="button"
            variant="outline-danger"
            size="md"
            onClick={onDelete}
            disabled={loading}
          >
            {t("delete")}
          </Button>
          <Button
            type="submit"
            variant="solid"
            size="md"
            disabled={submitting || loading}
          >
            {submitting ? t("saving") : t("save")}
          </Button>
        </div>
      </div>

      {/* Desktop error */}
      {error && (
        <p className="mb-6 hidden rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600 sm:block">
          {error}
        </p>
      )}
    </>
  );
}

export function MobileSaveBar({
  loading,
  submitting,
  error,
}: {
  loading: boolean;
  submitting: boolean;
  error: string | null;
}) {
  const t = useTranslations("dashboard.bookings.edit");

  return (
    <div className="mt-6 sm:hidden">
      {error && (
        <p className="mb-3 rounded-xl bg-red-100 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}
      <div className="grid grid-cols-1 gap-3">
        <Button
          type="submit"
          variant="solid"
          size="md"
          disabled={submitting || loading}
          className="w-full justify-center"
        >
          {submitting ? t("saving") : t("save")}
        </Button>
      </div>
    </div>
  );
}
