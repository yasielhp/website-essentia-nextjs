import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmationContent } from "./confirmation-content";

export const metadata: Metadata = {
  title: "Booking Requested | Essentia Tenerife",
  description: "Your booking request has been received. We will contact you shortly to confirm your appointment.",
};

export default function BookingConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
