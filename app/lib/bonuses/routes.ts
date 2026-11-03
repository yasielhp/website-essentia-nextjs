import { manualTherapyTreatments } from "@/data/services-data";
import { treatmentForTier } from "@/lib/treatments/match";
import { getPathname } from "../../../i18n/navigation";

/**
 * Where a bonus is bought.
 *
 * The payment page lives under the treatment it belongs to —
 * `…/<treatment>/bonus/checkout/<plan>` — so each family of treatments that
 * sells bonuses needs its own route. Today only the manual therapies has one;
 * facial therapies and IV therapy join by adding a family here, the matching
 * pathname in `i18n/routing.ts` and a page that mounts `BonusCheckoutPage`.
 */
export type BonusFamily = "manual-therapies";

type Locale = "en" | "es";

/** The localized path of a treatment's own page. */
export function treatmentHref(
  locale: Locale,
  family: BonusFamily,
  slug: string,
): string {
  switch (family) {
    case "manual-therapies":
      return getPathname({
        locale,
        href: {
          pathname: "/wellness/manual-therapies/[slug]",
          params: { slug },
        },
      });
  }
}

/** The localized path of the payment page for one plan of one treatment. */
export function bonusCheckoutHref(
  locale: Locale,
  family: BonusFamily,
  slug: string,
  planId: string,
): string {
  switch (family) {
    case "manual-therapies":
      return getPathname({
        locale,
        href: {
          pathname: "/wellness/manual-therapies/[slug]/bonus/checkout/[planId]",
          params: { slug, planId },
        },
      });
  }
}

/**
 * The treatment a session type belongs to, if it belongs to a family that has
 * a payment page. Null means the bonus cannot be bought online: there is no
 * page to buy it from.
 */
export function bonusRouteForTier(
  tierLabel: string | null | undefined,
): { family: BonusFamily; slug: string } | null {
  const manual = treatmentForTier(manualTherapyTreatments, tierLabel);
  return manual ? { family: "manual-therapies", slug: manual.id } : null;
}
