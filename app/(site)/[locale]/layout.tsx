import type { Metadata } from "next";
import { hasLocale } from "next-intl";
import { notFound } from "next/navigation";
import { routing } from "../../../i18n/routing";
import "../../globals.css";
import { fontVariables } from "@lib/fonts";
import { contact, OPENING_HOURS } from "@/constants/contact";
import { ConsentManager } from "@components/consent-manager";
import { AuthProvider } from "@components/auth-provider";
import { WebMcpTools } from "@components/webmcp-tools";
import { JsonLd } from "@/components/json-ld";
import { metadataBase, siteUrl } from "@/lib/site-url";

/**
 * The public site's root layout.
 *
 * It sits inside `[locale]` rather than at `app/` so that the locale arrives
 * through `params`. The previous root read it from `headers()`, and a dynamic
 * API in a root layout marks the whole application dynamic — which is why none
 * of these pages could be prerendered.
 */

export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

type Props = {
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({
  params,
}: Omit<Props, "children">): Promise<Metadata> {
  const { locale } = await params;

  return {
    metadataBase,
    title: {
      default: "Essentia — Longevity Center & Social Wellness Club in Tenerife",
      template: "%s | Essentia",
    },
    // What the centre offers today, for a page with no description of its own.
    description:
      "Wellness centre in Santa Cruz de Tenerife: manual therapies, therapeutic facials and IV therapy at Rambla de Santa Cruz, 83. Book online.",
    openGraph: {
      siteName: "Essentia Wellness Club",
      locale: locale === "es" ? "es_ES" : "en_US",
      type: "website",
      images: [{ url: "/opengraph-image", width: 1200, height: 630 }],
    },
    twitter: {
      card: "summary_large_image",
      images: ["/opengraph-image"],
    },
  };
}

function buildSchemaOrg(locale: string) {
  const isEs = locale === "es";
  return {
    "@context": "https://schema.org",
    "@graph": [
      {
        "@type": "Organization",
        "@id": `${siteUrl}/#organization`,
        name: "Essentia Wellness Club",
        url: siteUrl,
        logo: {
          "@type": "ImageObject",
          url: `${siteUrl}/images/logo-for-google-120x120.png`,
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "Rambla de Santa Cruz, 83",
          addressLocality: "Santa Cruz de Tenerife",
          addressRegion: "Santa Cruz de Tenerife",
          postalCode: "38004",
          addressCountry: "ES",
        },
        contactPoint: {
          "@type": "ContactPoint",
          telephone: contact.phone,
          email: contact.email,
          contactType: isEs ? "servicio al cliente" : "customer service",
          availableLanguage: ["Spanish", "English"],
        },
        sameAs: contact.socialMedia.map((s) => s.url),
      },
      {
        "@type": "WebSite",
        "@id": `${siteUrl}/#website`,
        url: siteUrl,
        name: "Essentia Wellness Club",
        publisher: { "@id": `${siteUrl}/#organization` },
        inLanguage: ["en-US", "es-ES"],
      },
      {
        "@type": ["LocalBusiness", "HealthAndBeautyBusiness", "MedicalClinic"],
        "@id": `${siteUrl}/#localbusiness`,
        name: "Essentia Wellness Club",
        image: `${siteUrl}/images/logo-for-google-120x120.png`,
        url: siteUrl,
        telephone: contact.phone,
        email: contact.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Rambla de Santa Cruz, 83",
          addressLocality: "Santa Cruz de Tenerife",
          addressRegion: "Santa Cruz de Tenerife",
          postalCode: "38004",
          addressCountry: "ES",
        },
        openingHoursSpecification: [
          {
            "@type": "OpeningHoursSpecification",
            dayOfWeek: [
              "Monday",
              "Tuesday",
              "Wednesday",
              "Thursday",
              "Friday",
              "Saturday",
              "Sunday",
            ],
            opens: OPENING_HOURS.opens,
            closes: OPENING_HOURS.closes,
          },
        ],
        priceRange: "€€€",
        medicalSpecialty: isEs
          ? ["Medicina Preventiva"]
          : ["Preventive Medicine"],
        // What can be booked today, and nothing that is only announced: the
        // hyperbaric chamber, regenerative medicine, contrast and red light
        // therapy are "coming soon" pages (`UNLAUNCHED_ROUTES`).
        availableService: isEs
          ? [
              { "@type": "MedicalTherapy", name: "Terapias Manuales" },
              { "@type": "MedicalTherapy", name: "Faciales Terapéuticos" },
              { "@type": "MedicalTherapy", name: "Terapia IV" },
            ]
          : [
              { "@type": "MedicalTherapy", name: "Manual Therapies" },
              { "@type": "MedicalTherapy", name: "Therapeutic Facials" },
              { "@type": "MedicalTherapy", name: "IV Therapy" },
            ],
      },
    ],
  };
}

export default async function SiteLayout({ children, params }: Props) {
  const { locale } = await params;
  if (!hasLocale(routing.locales, locale)) notFound();

  const schemaOrg = buildSchemaOrg(locale);

  return (
    <html lang={locale} data-scroll-behavior="smooth" className={fontVariables}>
      <head>
        <link
          rel="alternate"
          type="text/plain"
          title="LLMs.txt"
          href="/llms.txt"
        />
        <JsonLd data={schemaOrg} />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ConsentManager>{children}</ConsentManager>
        </AuthProvider>
        <WebMcpTools locale={locale} />
      </body>
    </html>
  );
}
