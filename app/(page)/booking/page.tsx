import type { Metadata } from "next";
import BookingSection from "@components/sections/booking/booking-section";

export const metadata: Metadata = {
  title: "Book a Session | Essentia Tenerife",
  description:
    "Book a wellness or medicine session at Essentia. Choose your service, pick a time, and we will take care of the rest.",
};

export default function BookPage() {
  return <BookingSection />;
}
