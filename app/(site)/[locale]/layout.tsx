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

const siteUrl = process.env.NEXT_PUBLIC_APP_URL ?? `https://${contact.domain}`;

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
    metadataBase: new URL(siteUrl),
    title: {
      default: "Essentia — Longevity Center & Social Wellness Club in Tenerife",
      template: "%s | Essentia",
    },
    description:
      "Longevity center & social wellness club in Tenerife. Science-backed protocols, medical therapies, and an exclusive community for a longer life.",
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
          streetAddress: "C. Roques del Salmor, 5",
          addressLocality: "Costa Adeje",
          addressRegion: "Santa Cruz de Tenerife",
          postalCode: "38679",
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
          streetAddress: "C. Roques del Salmor, 5",
          addressLocality: "Costa Adeje",
          addressRegion: "Santa Cruz de Tenerife",
          postalCode: "38679",
          addressCountry: "ES",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: "28.0863",
          longitude: "-16.7307",
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
          ? ["Medicina Preventiva", "Medicina Regenerativa"]
          : ["Preventive Medicine", "Regenerative Medicine"],
        availableService: isEs
          ? [
              {
                "@type": "MedicalTherapy",
                name: "Terapia de Oxígeno Hiperbárico",
              },
              { "@type": "MedicalTherapy", name: "Terapia Intravenosa" },
              { "@type": "MedicalTherapy", name: "Medicina Regenerativa" },
              { "@type": "MedicalTherapy", name: "Terapia de Contraste" },
              { "@type": "MedicalTherapy", name: "Terapia de Luz Roja" },
              { "@type": "MedicalTherapy", name: "Terapias Manuales" },
            ]
          : [
              { "@type": "MedicalTherapy", name: "Hyperbaric Oxygen Therapy" },
              { "@type": "MedicalTherapy", name: "Intravenous Therapy" },
              { "@type": "MedicalTherapy", name: "Regenerative Medicine" },
              { "@type": "MedicalTherapy", name: "Contrast Therapy" },
              { "@type": "MedicalTherapy", name: "Red Light Therapy" },
              { "@type": "MedicalTherapy", name: "Manual Therapies" },
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
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
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
