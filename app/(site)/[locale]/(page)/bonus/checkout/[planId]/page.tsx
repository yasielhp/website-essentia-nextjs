import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations, setRequestLocale } from "next-intl/server";
import { BonusCheckout } from "@/components/sections/bonus/bonus-checkout";
import { getPublicBonusPlan } from "@/lib/bonuses/public";

type Props = { params: Promise<{ locale: string; planId: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, planId } = await params;
  const t = await getTranslations({ locale, namespace: "bonus.form" });
  return {
    title: { absolute: t("pageTitle") },
    // A step on the way to the bank for one particular bonus: nothing to index.
    robots: { index: false, follow: false },
    alternates: {
      canonical:
        locale === "es"
          ? `/es/bonus/pago/${planId}`
          : `/bonus/checkout/${planId}`,
      languages: {
        en: `/bonus/checkout/${planId}`,
        es: `/es/bonus/pago/${planId}`,
        "x-default": `/bonus/checkout/${planId}`,
      },
    },
  };
}

export default async function BonusCheckoutPage({ params }: Props) {
  const { locale, planId } = await params;
  setRequestLocale(locale);

  // Read on the server with the same public filters as the treatment page: a
  // plan that is off, or never existed, is a 404.
  const plan = await getPublicBonusPlan(planId);
  if (!plan) notFound();

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center px-5 pt-32 pb-24 md:pt-44">
      <div className="w-full max-w-xl">
        <BonusCheckout plan={plan} />
      </div>
    </section>
  );
}
