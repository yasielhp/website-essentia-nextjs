import type { Metadata } from "next";
import { Suspense } from "react";
import { RequestedContent } from "./requested-content";

export const metadata: Metadata = {
  title: "Request Received | Essentia Tenerife",
  description:
    "Your booking request has been received. We will contact you shortly to confirm your appointment.",
};

export default function BookingRequestedPage() {
  return (
    <Suspense>
      <RequestedContent />
    </Suspense>
  );
}
