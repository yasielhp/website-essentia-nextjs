import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { BonusCheckoutStepper } from "@/components/sections/bonus/bonus-checkout-stepper";
import { listPublicBonusPlans } from "@/lib/bonuses/public";
import type { BonusFamily } from "@/lib/bonuses/routes";

/**
 * The payment page for a bonus, shared by every family of treatments that sells
 * them (manual therapies today; the facial and IV routes mount the same thing).
 *
 * The bonuses are read here, on the server, with the public filters — active
 * plan, active session type, public fields only — for the treatment in the URL,
 * and the one in the URL must be among them: a plan id pasted under another
 * treatment, or one that is switched off, is a 404 that says nothing about why.
 * The heading renders on the server; the steps are the browser's.
 */
export async function BonusCheckoutPage({
  locale,
  family,
  slug,
  treatmentTitle,
  planId,
}: {
  locale: string;
  family: BonusFamily;
  slug: string;
  /** The treatment in the URL; its title is its session type's label. */
  treatmentTitle: string;
  planId: string;
}) {
  const plans = await listPublicBonusPlans(treatmentTitle);
  if (!plans.some((p) => p.id === planId)) notFound();

  const t = await getTranslations({ locale, namespace: "bonus.form" });

  return (
    // The same frame as the booking page, so the two flows read as one.
    <section className="bg-sand-50 md:min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 md:pt-48">
        <h1 className="font-display text-petroleum-700 mb-8 text-4xl md:text-5xl">
          {t("title")}
        </h1>
        <BonusCheckoutStepper
          plans={plans}
          initialPlanId={planId}
          family={family}
          slug={slug}
        />
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
