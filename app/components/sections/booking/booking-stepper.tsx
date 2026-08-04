"use client";

import dynamic from "next/dynamic";

/**
 * The booking flow reads `window` and browser storage as it goes, so it stays
 * client-only. Isolating it here keeps the surrounding page server-rendered.
 */
const BookingContent = dynamic(
  () =>
    import("./booking-content").then((m) => ({ default: m.BookingContent })),
  { ssr: false },
);

export function BookingStepper() {
  return <BookingContent />;
}
