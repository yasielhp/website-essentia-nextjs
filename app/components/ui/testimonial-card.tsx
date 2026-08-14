import { IconQuote } from "@/components/ui/icons";
import { ReviewAvatar } from "@/components/ui/review-avatar";

/**
 * One Google review as a card.
 *
 * Shared between the home carousel and the reviews page rather than drawn twice
 * — two copies of the same card drift the moment one of them is touched, and
 * these two sit one click apart.
 *
 * Not a Client Component: it holds no state. `ReviewAvatar` is, and brings its
 * own boundary with it.
 */

export type TestimonialItem = {
  /** Google returns one per review; unique enough for a key. */
  id: string;
  quote: string;
  name: string;
  /** Google's own wording for the age of the review. */
  when: string;
  /** Null when the reviewer has no picture on their Google account. */
  photoUrl: string | null;
  /** Their Google profile. Attribution the Places policy requires. */
  profileUrl: string | null;
  /** Only drawn when there is no photo. */
  initials: string;
  /** Interpolated link label for the reviewer's Google profile. */
  profileLabel: string;
  bgColor: string;
  textColor: string;
  avatarBg: string;
  avatarText: string;
  mutedColor: string;
};

export function TestimonialCard({
  t,
  compact = false,
  clamp = true,
  eager = false,
}: {
  t: TestimonialItem;
  /** The tighter card the desktop carousel fits three of across. */
  compact?: boolean;
  /** Passed to the avatar for the cards that render above the fold. */
  eager?: boolean;
  /**
   * Cards inside the carousel share a fixed height, so a six-hundred-character
   * review has to be cut somewhere. The reviews page is where someone goes to
   * read them, and cutting them there would defeat the trip.
   */
  clamp?: boolean;
}) {
  return (
    <div
      className={`${t.bgColor} relative flex h-full flex-col justify-between rounded-2xl ${
        compact ? "gap-4 p-5" : "gap-6 p-7"
      }`}
    >
      <div
        aria-hidden="true"
        className={`absolute top-4 left-5 ${t.textColor}`}
      >
        <IconQuote className="h-8 w-8 opacity-15" />
      </div>

      <p
        className={`font-body ${t.textColor} leading-snug ${
          compact ? "pt-5 text-base" : "pt-6 text-lg"
        } ${clamp ? (compact ? "line-clamp-7" : "line-clamp-[12]") : ""}`}
      >
        {t.quote}
      </p>

      <div className="flex items-center gap-3">
        <ReviewAvatar
          photoUrl={t.photoUrl}
          initials={t.initials}
          size={compact ? 32 : 40}
          className={compact ? "h-8 w-8" : "h-10 w-10"}
          fallbackClassName={`${t.avatarBg} ${t.avatarText}`}
          eager={eager}
        />
        <div>
          <p
            className={`${t.textColor} font-medium ${compact ? "text-xs" : "text-sm"}`}
          >
            {/* Showing the picture obliges us to link the profile it belongs
            to; the name carries the link so the target is a word, not an
            image. */}
            {t.profileUrl ? (
              <a
                href={t.profileUrl}
                target="_blank"
                rel="noopener noreferrer nofollow"
                aria-label={t.profileLabel}
                className="hover:underline"
              >
                {t.name}
              </a>
            ) : (
              t.name
            )}
          </p>
          <p className={`${t.mutedColor} text-xs`}>{t.when}</p>
        </div>
      </div>
    </div>
  );
}
