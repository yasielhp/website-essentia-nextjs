import { unstable_cache } from "next/cache";

/**
 * The reviews on the Google listing, which are the only reviews this site
 * shows.
 *
 * SERVER ONLY — it reads `GOOGLE_PLACES_API_KEY`, which must never carry the
 * `NEXT_PUBLIC_` prefix: that would inline it into the browser bundle.
 *
 * One function, deliberately. The Places API hands back at most five reviews
 * however the request is phrased, and the listing has far more than five; the
 * day that matters, the way out is the Business Profile API, which needs OAuth
 * as the owner of the listing and Google's approval. Keeping the fetch behind
 * this boundary means that swap costs a rewrite of this file and nothing else.
 */

const ENDPOINT = "https://places.googleapis.com/v1/places";
const FIELD_MASK = "rating,userRatingCount,googleMapsUri,reviews";
const TIMEOUT_MS = 8_000;

/**
 * Six hours.
 *
 * Not only for speed. Places forbids storing the content of a place
 * indefinitely — the `place_id` is the single exempt field — and requires a
 * refresh at least every thirty days. A short cache honours that by
 * construction, and reviews arrive at a pace where six hours is invisible.
 */
const CACHE_SECONDS = 6 * 60 * 60;

export type GoogleReview = {
  /** Stable enough for a React key: Google returns one per review. */
  id: string;
  rating: number;
  text: string;
  authorName: string;
  /** Google's own wording — "Hace 2 meses", "in the last week". */
  publishedRelative: string;
  /** Null when the reviewer has no picture. */
  authorPhotoUrl: string | null;
  /** The reviewer's Google profile. Required attribution when the photo shows. */
  authorProfileUrl: string | null;
};

export type GooglePlaceReviews = {
  /** Average over every rating, not only the five returned. */
  rating: number | null;
  /** How many ratings the listing holds, with or without text. */
  userRatingCount: number | null;
  /** The listing itself, for the "read them all on Google" link. */
  googleMapsUri: string | null;
  reviews: GoogleReview[];
};

const EMPTY: GooglePlaceReviews = {
  rating: null,
  userRatingCount: null,
  googleMapsUri: null,
  reviews: [],
};

type PlacesResponse = {
  rating?: number;
  userRatingCount?: number;
  googleMapsUri?: string;
  reviews?: {
    name?: string;
    rating?: number;
    text?: { text?: string };
    relativePublishTimeDescription?: string;
    authorAttribution?: {
      displayName?: string;
      photoUri?: string;
      uri?: string;
    };
  }[];
};

async function fetchPlaceReviews(
  language: string,
): Promise<GooglePlaceReviews> {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACES_PLACE_ID;
  // Missing credentials are a normal state, not an error: the section simply
  // does not render, exactly as it behaves when Google is down.
  if (!key || !placeId) return EMPTY;

  try {
    const response = await fetch(
      `${ENDPOINT}/${placeId}?languageCode=${encodeURIComponent(language)}`,
      {
        headers: { "X-Goog-Api-Key": key, "X-Goog-FieldMask": FIELD_MASK },
        signal: AbortSignal.timeout(TIMEOUT_MS),
        // `unstable_cache` above is the only cache; a second one underneath it
        // would make the six-hour window unpredictable.
        cache: "no-store",
      },
    );
    if (!response.ok) return EMPTY;

    const payload = (await response.json()) as PlacesResponse;

    return {
      rating: payload.rating ?? null,
      userRatingCount: payload.userRatingCount ?? null,
      googleMapsUri: payload.googleMapsUri ?? null,
      reviews: (payload.reviews ?? [])
        .map((review, index) => {
          const author = review.authorAttribution;
          return {
            id: review.name ?? `review-${index}`,
            rating: review.rating ?? 0,
            text: review.text?.text?.trim() ?? "",
            authorName: author?.displayName?.trim() ?? "",
            publishedRelative: review.relativePublishTimeDescription ?? "",
            authorPhotoUrl: author?.photoUri ?? null,
            authorProfileUrl: author?.uri ?? null,
          };
        })
        // A rating with no words is a rating, not a testimonial, and an
        // anonymous quote persuades nobody.
        .filter((review) => review.text && review.authorName),
    };
  } catch {
    // Never throws: reviews are decoration on a page that sells appointments,
    // and a Google outage must not take the home page with it.
    return EMPTY;
  }
}

/**
 * Asking in Spanish and asking in English does not return the same five reviews
 * translated — Google picks the five most relevant *for that language*, so the
 * Spanish page shows local clients and the English one shows visitors. Hence
 * the language in the cache key rather than one shared entry.
 */
export const getGoogleReviews = unstable_cache(
  fetchPlaceReviews,
  ["google-place-reviews"],
  { revalidate: CACHE_SECONDS, tags: ["google-reviews"] },
);
