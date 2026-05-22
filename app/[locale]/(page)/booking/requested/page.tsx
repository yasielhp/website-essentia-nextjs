import type { Metadata } from "next";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { RequestedContent } from "./requested-content";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("booking.requested");
  return {
    title: t("heading"),
    description: t("body"),
  };
}

export default function BookingRequestedPage() {
  return (
    <Suspense>
      <RequestedContent />
    </Suspense>
  );
}
