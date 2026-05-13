import type { Metadata } from "next";
import ContactSection from "@components/sections/contact/contact-section";

export const metadata: Metadata = {
  title: "Contact Essentia | Get in Touch",
  description:
    "Contact Essentia's team in Tenerife to learn more about our longevity center, wellness programs, and membership options.",
};

export default function ContactPage() {
  return <ContactSection />;
}
