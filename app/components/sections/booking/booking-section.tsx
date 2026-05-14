import { Suspense } from "react";
import { BookingContent } from "./booking-content";

export default function BookingSection() {
  return (
    <section className="bg-sand-50 md:min-h-dvh">
      <div className="mx-auto max-w-4xl px-5 pt-32 pb-24 md:pt-48">
        <Suspense>
          <BookingContent />
        </Suspense>
      </div>
    </section>
  );
}
