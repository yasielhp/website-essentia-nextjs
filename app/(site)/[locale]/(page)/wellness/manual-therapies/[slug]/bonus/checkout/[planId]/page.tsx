import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { manualTherapyTreatments } from "@/data/services-data";
import {
  BonusCheckoutPage,
  bonusCheckoutMetadata,
} from "@/components/sections/bonus/bonus-checkout-page";
import { bonusCheckoutHref, treatmentHref } from "@/lib/bonuses/routes";

type Props = {
  params: Promise<{ locale: string; slug: string; planId: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, slug, planId } = await params;
  return bonusCheckoutMetadata({
    locale,
    paths: {
      en: bonusCheckoutHref("en", "manual-therapies", slug, planId),
      es: bonusCheckoutHref("es", "manual-therapies", slug, planId),
    },
  });
}

export default async function ManualTherapyBonusCheckoutPage({
  params,
}: Props) {
  const { locale, slug, planId } = await params;
  setRequestLocale(locale);

  const treatment = manualTherapyTreatments.find((s) => s.id === slug);
  if (!treatment) notFound();

  return (
    <BonusCheckoutPage
      treatmentTitle={treatment.title}
      planId={planId}
      backHref={treatmentHref(
        locale === "es" ? "es" : "en",
        "manual-therapies",
        slug,
      )}
    />
  );
}
