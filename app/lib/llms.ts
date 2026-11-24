import enMedicine from "../../messages/en/medicine.json";
import enWellness from "../../messages/en/wellness.json";
import { contact, OPENING_HOURS } from "@/constants/contact";
import {
  bookableServices,
  facialTreatments,
  ivProtocols,
  manualTherapyTreatments,
} from "@/data/services-data";
import {
  NOTHING_HIDDEN,
  type HiddenTreatments,
} from "@/lib/treatments/visibility";

/**
 * The two files the site publishes for assistants, `/llms.txt` and
 * `/llms-full.txt`, BUILT from what the site itself is made of: the services
 * that can be booked, their treatments, the names and descriptions in the
 * English translations, the address of the centre.
 *
 * They used to be written by hand, and went on describing a centre that had
 * moved: a treatment under the name before its last two, a price list with a
 * suite the centre no longer works in, services that only ever said "coming
 * soon". A file nobody regenerates says what was true the day it was typed.
 *
 * So: nothing here is a figure or a name typed for these files. Only what can
 * be booked today is listed (a service that is announced and not open has no
 * place in them, nor a treatment whose session type the centre switched off),
 * and NO PRICE: the centre changes its prices itself, and each treatment's own
 * page prints the current one.
 *
 * They are served by two route handlers (`app/llms.txt/route.ts`,
 * `app/llms-full.txt/route.ts`), not kept as files in `public/`: which
 * treatments are switched off is read from the database (`hidden`, from
 * `listAllHiddenTreatments`), and a file written at build time would go on
 * listing a treatment after it was switched off, or leave it out after it was
 * switched back on, until somebody rebuilt it and deployed. Pure: the hidden
 * treatments are handed in, and nothing hidden is the default.
 */

const SITE = `https://${contact.domain}`;

type Card = { title: string; description: string; meta?: string };

const manualCards = enWellness.treatments.manualTherapiesCards as Record<
  string,
  Card
>;
const facialCards = enWellness.treatments.facialCards as Record<string, Card>;
const ivCards = enMedicine.iv.protocols as Record<string, Card>;

/** One treatment, as both files list it. */
type Entry = {
  name: string;
  url: string;
  /** How long it lasts, or the words its card says instead. */
  length: string;
  description: string;
};

type Family = {
  id: string;
  title: string;
  url: string;
  description: string;
  /** A note of the centre's own about every treatment of the family. */
  note?: string;
  entries: Entry[];
};

function family(id: string, entries: Entry[], note?: string): Family {
  const service = bookableServices.find((s) => s.id === id);
  if (!service) throw new Error(`llms: "${id}" is not a bookable service`);
  return {
    id,
    title: service.title,
    url: `${SITE}/${service.category}/${service.id}`,
    description: service.description,
    note,
    entries,
  };
}

/**
 * The services that can be booked today, each with its treatments, less those
 * whose session type is switched off (`hidden`).
 */
export function llmsFamilies(
  hidden: HiddenTreatments = NOTHING_HIDDEN,
): Family[] {
  const manualUrl = `${SITE}/wellness/manual-therapies`;
  const facialUrl = `${SITE}/wellness/facial-therapies`;
  const ivUrl = `${SITE}/medicine/intravenous-therapy`;
  const shown =
    (family: keyof HiddenTreatments) =>
    (t: { id: string }): boolean =>
      !hidden[family].includes(t.id);

  return [
    family(
      "manual-therapies",
      manualTherapyTreatments.filter(shown("manual-therapies")).map((t) => ({
        name: manualCards[t.id]?.title ?? t.title,
        url: `${manualUrl}/${t.id}`,
        length: t.durations.join(" / "),
        description: manualCards[t.id]?.description ?? t.description,
      })),
      enWellness.treatments.aromaNote,
    ),
    family(
      "facial-therapies",
      facialTreatments.filter(shown("facial-therapies")).map((t) => ({
        name: facialCards[t.id]?.title ?? t.title,
        url: `${facialUrl}/${t.id}`,
        length: t.durations
          ? t.durations.join(" / ")
          : (facialCards[t.id]?.meta ?? ""),
        description: facialCards[t.id]?.description ?? t.description,
      })),
    ),
    family(
      "intravenous-therapy",
      ivProtocols.filter(shown("intravenous-therapy")).map((p) => ({
        name: ivCards[p.id]?.title ?? p.title,
        url: `${ivUrl}/${p.id}`,
        length: ivCards[p.id]?.meta ?? "",
        description: ivCards[p.id]?.description ?? p.description,
      })),
      enMedicine.iv.disclaimer,
    ),
  ];
}

const SUMMARY =
  "Essentia is a longevity centre and social wellness club in Santa Cruz de Tenerife, Canary Islands, Spain. Today it offers manual therapies, therapeutic facials and IV therapy, booked online and given at the centre.";

const NO_PRICES =
  "Prices are not listed in this file. The centre changes them, and the current price of each treatment is on its own page, under its name, next to how long it lasts.";

/**
 * How a booking is paid, changed and cancelled: the rule of the Terms (3.1 and
 * 3.2) and of the booking form, in one sentence an assistant can quote.
 */
const PAYMENT_POLICY =
  "The full price is paid online when booking. A booking can be changed or cancelled up to 24 hours before the session, and a cancellation made at least 24 hours ahead is refunded; within the last 24 hours, or for a no-show, there is no refund.";

const ADDRESS = `${contact.address}, Canary Islands, Spain`;

/** The pages of the site that are open today and are not a treatment. */
const PAGES: { label: string; path: string; note: string }[] = [
  {
    label: "Book a session",
    path: "/booking",
    note: "Choose the treatment, the day and the hour, and pay the full price online.",
  },
  { label: "Wellness", path: "/wellness", note: "The wellness services." },
  { label: "Medicine", path: "/medicine", note: "The medicine services." },
  {
    label: "Memberships",
    path: "/experiences/memberships",
    note: "Membership plans. Conditions and current prices are on the page.",
  },
  { label: "About", path: "/about", note: "The centre and its team." },
  { label: "Contact", path: "/contact", note: "Contact form and directions." },
  { label: "Blog", path: "/blog", note: "Articles." },
  {
    label: "Reviews",
    path: "/reviews",
    note: "Accounts from people treated at the centre.",
  },
];

const LEGAL: { label: string; path: string }[] = [
  { label: "Legal notice", path: "/legal" },
  { label: "Privacy Policy", path: "/privacy" },
  { label: "Terms", path: "/terms" },
  { label: "Cookies", path: "/cookies" },
];

const social = () =>
  contact.socialMedia.map((s) => `- ${s.name}: ${s.url}`).join("\n");

/** `/llms.txt`: the short index. */
export function buildLlmsTxt(
  hidden: HiddenTreatments = NOTHING_HIDDEN,
): string {
  const families = llmsFamilies(hidden);
  return [
    "# Essentia Wellness Club",
    "",
    `> ${SUMMARY}`,
    "",
    `- Website: ${SITE}`,
    `- Address: ${ADDRESS}`,
    `- Map: ${contact.mapsUrl}`,
    `- Email: ${contact.email}`,
    `- Phone: ${contact.phone}`,
    `- Booking: ${SITE}/booking`,
    social(),
    "- Languages: English and Spanish (the Spanish pages are under /es/)",
    "",
    NO_PRICES,
    "",
    PAYMENT_POLICY,
    "",
    "## Services",
    "",
    "Bookable online, given at the centre.",
    "",
    ...families.map(
      (f) =>
        `- [${f.title}](${f.url}): ${f.description} ${f.entries.length} treatments, each with its own page.`,
    ),
    ...families.flatMap((f) => [
      "",
      `## ${f.title}`,
      "",
      ...f.entries.map((e) => `- [${e.name}](${e.url}): ${e.length}`),
    ]),
    "",
    "## Pages",
    "",
    ...PAGES.map((p) => `- [${p.label}](${SITE}${p.path}): ${p.note}`),
    "",
    "## Optional",
    "",
    `- [Complete reference](${SITE}/llms-full.txt): every treatment with its description.`,
    ...LEGAL.map((p) => `- [${p.label}](${SITE}${p.path})`),
    "",
  ].join("\n");
}

/** `/llms-full.txt`: every treatment, with its description. */
export function buildLlmsFullTxt(
  hidden: HiddenTreatments = NOTHING_HIDDEN,
): string {
  const families = llmsFamilies(hidden);
  return [
    "# Essentia Wellness Club — Complete Reference",
    "",
    `> ${SUMMARY}`,
    "",
    "---",
    "",
    "## Contact and location",
    "",
    `- **Address:** ${ADDRESS}`,
    `- **Map:** ${contact.mapsUrl}`,
    `- **Website:** ${SITE}`,
    `- **Email:** ${contact.email}`,
    `- **Phone:** ${contact.phone}`,
    ...contact.socialMedia.map((s) => `- **${s.name}:** ${s.url}`),
    `- **Reception hours:** ${OPENING_HOURS.opens}–${OPENING_HOURS.closes}`,
    "- **Languages:** English and Spanish (the Spanish pages are under /es/)",
    "",
    "---",
    "",
    "## Booking and prices",
    "",
    `- **Booking:** ${SITE}/booking — choose the service, the treatment, the day and the hour, and pay the full price online.`,
    "- **Where:** every session takes place at the centre.",
    `- **Prices:** ${NO_PRICES}`,
    `- **Payment and cancellation:** ${PAYMENT_POLICY}`,
    ...families.flatMap((f) => [
      "",
      "---",
      "",
      `## ${f.title}`,
      "",
      `- **URL:** ${f.url}`,
      `- **Description:** ${f.description}`,
      ...(f.note ? [`- **Note:** ${f.note}`] : []),
      ...f.entries.flatMap((e) => [
        "",
        `### ${e.name}`,
        "",
        `- **Session:** ${e.length}`,
        `- **Page and current price:** ${e.url}`,
        `- **Description:** ${e.description}`,
      ]),
    ]),
    "",
    "---",
    "",
    "## Other pages",
    "",
    ...PAGES.map((p) => `- **${p.label}:** ${SITE}${p.path} — ${p.note}`),
    ...LEGAL.map((p) => `- **${p.label}:** ${SITE}${p.path}`),
    "",
  ].join("\n");
}
