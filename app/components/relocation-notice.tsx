import { Link } from "../../i18n/navigation";
import { useTranslations } from "next-intl";

/**
 * When the studio opens again in Santa Cruz: Monday 2 November 2026, 00:00.
 *
 * The Canaries are on UTC+0 from the last Sunday of October, so UTC is the
 * local midnight here. From that moment the banner renders nothing, which is
 * what stops the site promising a return date that has already passed.
 */
const REOPENS_AT = Date.UTC(2026, 10, 2);

/**
 * The one line that explains why the rest of the site says "Próximamente".
 *
 * It is fixed above the header rather than dismissible: a visitor who lands on
 * a treatment page three weeks from now needs it as much as today's, and it is
 * what makes the disabled booking buttons legible.
 *
 * The whole sentence is the link, with no underline: the bar is the target,
 * and it only brightens on hover.
 *
 * On desktop it fills the gap the header already leaves above itself
 * (`md:mt-16`), so nothing moves. On mobile it is 48px tall — two lines of
 * text — and the header's `top-12` has to match, or they overlap.
 *
 * To remove once the move is old news: drop `<RelocationNotice />` from
 * `app/(site)/[locale]/(page)/layout.tsx` and restore the header's `top-0`.
 * Until somebody does, it switches itself off on the reopening day.
 */
export function RelocationNotice() {
  const t = useTranslations("common.relocation");

  // Reading the clock is impure, and `react-hooks/purity` is right to say so
  // for a component that could be rendered once and cached. This one cannot:
  // the root layout derives the locale from `headers()`, which opts the whole
  // app into rendering per request, so the comparison runs on every visit.
  // eslint-disable-next-line react-hooks/purity
  if (Date.now() >= REOPENS_AT) return null;

  return (
    <div className="bg-petroleum-700 text-sand-100 fixed top-0 right-0 left-0 z-20 flex h-12 items-center justify-center px-4 md:h-10">
      {/* Two lines on a phone rather than one truncated sentence: cutting it
          short dropped "Santa Cruz", which is the half that matters. */}
      <Link
        href="/contact"
        className="text-center text-xs leading-tight text-balance transition-colors hover:text-white md:text-sm"
      >
        {t("banner")}
      </Link>
    </div>
  );
}
