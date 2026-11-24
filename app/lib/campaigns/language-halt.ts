import type { CampaignAudience, CampaignLocale } from "@/types/campaign";
import { haltMessage, haltMessageIn, parseLocaleHalt } from "./error-markers";
import { CAMPAIGN_LOCALES, audienceLocales } from "./languages";

/**
 * What a WhatsApp send does when Meta keeps refusing the template of ONE
 * language of a campaign written in two. Pure: the senders and their tests
 * share it.
 *
 * The decision: that language is HELD, not the whole campaign. Its rows stay
 * `queued` and unclaimed while the other language goes on, which is what
 * already happens when the local copy of the account's templates says a
 * language's template cannot go out (`sendQueuedWhatsApp` leaves those rows in
 * the queue): an English template Meta refuses must not cost the Spanish
 * clients their notice. The whole campaign stops (a one-off becomes `failed`,
 * an automation `paused`) only when every language it is written in is
 * stopped, which is also the only case a campaign in one language has.
 *
 * The hold is written on the campaign (`haltMessageIn` in `last_error`) and
 * read back by the next run, so it lasts across ticks. It is lifted by a
 * person: switching the automation off and on again, or retrying the one-off
 * send, clears `last_error`; if Meta still refuses, the streak of refusals
 * already on the rows holds the language again at its first new refusal.
 */

/** A language whose template Meta kept refusing for one reason. */
export type LocaleHalt = { locale: CampaignLocale; reason: string };

export type HaltStop = {
  /** Every language the campaign is written in is stopped: stop the campaign. */
  all: boolean;
  /** What `last_error` says: with the language unless it is about all of them. */
  marker: string;
  /** Meta's reason, as stored on the rows. */
  reason: string;
  /** The language the marker names, or null when it names none. */
  locale: CampaignLocale | null;
};

/**
 * The language a run must hold back before it sends anything: the one the
 * campaign's `last_error` says is held, when the campaign is written in more
 * than one. Null when there is none.
 */
export function heldLocale(
  audience: Pick<CampaignAudience, "language">,
  lastError: string | null | undefined,
): CampaignLocale | null {
  const held = parseLocaleHalt(lastError);
  const locales = audienceLocales(audience);
  return held && locales.length > 1 && locales.includes(held.locale)
    ? held.locale
    : null;
}

/**
 * What a run leaves on the campaign, from the hold it found (`lastError`) and
 * the languages it stopped itself (`halts`), or null when nothing is stopped.
 *
 * - A campaign in one language stops whole, with the marker it always had
 *   (`[halted] reason`, no language).
 * - In two, a language stopped while the other still goes out is a hold:
 *   `all` is false and the marker names it (`[halted] (en) reason`).
 * - When both are stopped the campaign stops whole; the marker names no
 *   language when both were refused for the same reason (the account, not a
 *   template), else the language this run stopped.
 */
export function haltDecision(
  audience: Pick<CampaignAudience, "language">,
  lastError: string | null | undefined,
  halts: readonly LocaleHalt[],
): HaltStop | null {
  const locales = audienceLocales(audience);
  const held = heldLocale(audience, lastError);
  const heldReason = held ? (parseLocaleHalt(lastError)?.reason ?? "") : null;
  const fresh = CAMPAIGN_LOCALES.flatMap((locale) => {
    const halt = halts.find((h) => h.locale === locale);
    return halt && locales.includes(locale) && locale !== held ? [halt] : [];
  });

  const [first] = fresh;
  if (!first) {
    return held && heldReason !== null
      ? {
          all: false,
          marker: haltMessageIn(held, heldReason),
          reason: heldReason,
          locale: held,
        }
      : null;
  }

  const stopped = new Set<CampaignLocale>(fresh.map((h) => h.locale));
  if (held) stopped.add(held);
  const all = locales.every((locale) => stopped.has(locale));
  const reasons = new Set(fresh.map((h) => h.reason));
  if (heldReason !== null) reasons.add(heldReason);
  const plain = locales.length < 2 || (all && reasons.size === 1);
  return {
    all,
    marker: plain
      ? haltMessage(first.reason)
      : haltMessageIn(first.locale, first.reason),
    reason: first.reason,
    locale: plain ? null : first.locale,
  };
}
