import { contact } from "@/constants/contact";
import type { FaqItem } from "@/components/sections/service-faq";

const base = `https://${contact.domain}`;

type BreadcrumbItem = { name: string; url: string };

export function breadcrumbSchema(items: BreadcrumbItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: `${base}${item.url}`,
    })),
  };
}

export function faqPageSchema(faqs: FaqItem[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

/**
 * A single therapy as its own entity, linked to the clinic.
 *
 * The home page lists every therapy inside the `LocalBusiness`, but each
 * service page had no entity of its own — nothing tied the page to what it
 * describes. `provider` points at the same `@id`, so the graph stays connected
 * instead of repeating the business on every page.
 *
 * No `offers`: prices live in `service_tiers` and differ between the centre and
 * the suite, so any single figure here would be wrong for half the bookings.
 */
export function medicalTherapySchema({
  name,
  description,
  url,
  category,
}: {
  name: string;
  description: string;
  url: string;
  category?: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "MedicalTherapy",
    name,
    description,
    url: `${base}${url}`,
    ...(category ? { category } : {}),
    provider: { "@id": `${base}/#localbusiness` },
    availableAtOrFrom: { "@id": `${base}/#localbusiness` },
  };
}

/** The longest a page title may be before a search result cuts it. */
export const META_TITLE_MAX = 65;

/**
 * The title of a treatment's page: its name and the family it belongs to
 * (`Espira | Terapias Manuales · Essentia`). A name long enough to push that
 * past what a search result shows is the title on its own, rather than a title
 * cut off in the middle of the family.
 */
export function treatmentMetaTitle(name: string, suffix: string): string {
  const full = `${name} | ${suffix}`;
  return full.length <= META_TITLE_MAX ? full : name;
}
