import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BonusCheckout } from "@/components/sections/bonus/bonus-checkout";
import { getPublicBonusPlan } from "@/lib/bonuses/public";
import { sameTreatment } from "@/lib/treatments/match";

/**
 * The payment page for a bonus, shared by every family of treatments that sells
 * them (manual therapies today; the facial and IV routes mount the same thing).
 *
 * The plan is read here, on the server, with the public filters — active plan,
 * active session type, public fields only — and must belong to the treatment in
 * the URL: a plan id pasted under another treatment, or one that is switched
 * off, is a 404 that says nothing about why.
 */
export async function BonusCheckoutPage({
  treatmentTitle,
  planId,
  backHref,
}: {
  /** The treatment in the URL; its title is its session type's label. */
  treatmentTitle: string;
  planId: string;
  /** The treatment's own page, which "Back" returns to. */
  backHref: string;
}) {
  const plan = await getPublicBonusPlan(planId);
  if (!plan || !sameTreatment(plan.tierLabel, treatmentTitle)) notFound();

  return (
    <section className="bg-sand-50 flex min-h-dvh flex-col items-center px-5 pt-32 pb-24 md:pt-44">
      <div className="w-full max-w-xl">
        <BonusCheckout plan={plan} backHref={backHref} />
      </div>
    </section>
  );
}

/** Metadata for that page: private to the buyer, so out of the index. */
export async function bonusCheckoutMetadata({
  locale,
  paths,
}: {
  locale: string;
  /** The page's own path in each language, locale prefix included. */
  paths: { en: string; es: string };
}): Promise<Metadata> {
  const t = await getTranslations({ locale, namespace: "bonus.form" });
  return {
    title: { absolute: t("pageTitle") },
    robots: { index: false, follow: false },
    alternates: {
      canonical: locale === "es" ? paths.es : paths.en,
      languages: { en: paths.en, es: paths.es, "x-default": paths.en },
    },
  };
}
