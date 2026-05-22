import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import ContactSection from "@components/sections/contact/contact-section";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("contact.meta");
  return {
    title: t("title"),
    description: t("description"),
  };
}

export default function ContactPage() {
  return <ContactSection />;
}
