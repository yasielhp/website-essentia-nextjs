"use client";

import dynamic from "next/dynamic";

const BookingContent = dynamic(
  () =>
    import("./booking-content").then((m) => ({ default: m.BookingContent })),
  { ssr: false },
);

export default function BookingSection() {
  return (
    <section className="bg-sand-50 md:min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 md:pt-48">
        <BookingContent />
      </div>
    </section>
  );
}
