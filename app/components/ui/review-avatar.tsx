"use client";

import { useState } from "react";
import Image from "next/image";

/**
 * The Google reviewer's picture, with their initials behind it.
 *
 * A Client Component so the fallback can react to `onError`, which is why it
 * lives here rather than inside either of the two places that draw a review:
 * the reviews page is a Server Component and cannot hold the state itself.
 *
 * `unoptimized` because these are already small, already square thumbnails on
 * Google's own CDN — running them through the image optimiser would cost a
 * round trip and a cache entry to arrive at the same pixels.
 *
 * The initials are the fallback, not the design: a reviewer with no picture on
 * their account comes back with no `photoUri`, and a request that fails would
 * otherwise leave a broken-image glyph beside somebody's name for the life of
 * the page, an `img` that fails never retrying.
 */
export function ReviewAvatar({
  photoUrl,
  initials,
  size = 40,
  className = "",
  fallbackClassName = "bg-petroleum-100 text-petroleum-700",
  eager = false,
}: {
  photoUrl: string | null;
  initials: string;
  size?: number;
  /** Sizing utilities; the same box has to apply to photo and fallback alike. */
  className?: string;
  fallbackClassName?: string;
  /**
   * For the handful that sit above the fold. On the reviews page there is no
   * hero image, which leaves a 40px avatar as the Largest Contentful Paint —
   * and a lazy LCP element is one Next warns about, rightly: the browser waits
   * for layout before it even asks for it.
   */
  eager?: boolean;
}) {
  const [failed, setFailed] = useState(false);

  if (photoUrl && !failed) {
    return (
      <Image
        src={photoUrl}
        alt=""
        width={size}
        height={size}
        unoptimized
        loading={eager ? "eager" : "lazy"}
        onError={() => setFailed(true)}
        className={`${className} shrink-0 rounded-full object-cover`}
      />
    );
  }

  return (
    <div
      className={`${className} ${fallbackClassName} flex shrink-0 items-center justify-center rounded-full text-xs font-medium`}
    >
      {initials}
    </div>
  );
}
