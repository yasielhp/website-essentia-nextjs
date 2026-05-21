import type { Metadata } from "next";
import { Suspense } from "react";
import { ConfirmationContent } from "./confirmation-content";

export const metadata: Metadata = {
  title: "Booking Confirmed | Essentia Tenerife",
  description: "Your payment has been processed and your appointment is confirmed.",
};

export default function BookingConfirmationPage() {
  return (
    <Suspense>
      <ConfirmationContent />
    </Suspense>
  );
}
