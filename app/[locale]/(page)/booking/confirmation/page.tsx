import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { ConfirmationContent } from "./confirmation-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("booking.confirmation");
  return {
    title: t("heading"),
    description: t("body"),
  };
}

export default function BookingConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
