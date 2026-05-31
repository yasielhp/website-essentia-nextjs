import type { Metadata } from "next";
import { headers } from "next/headers";
import localFont from "next/font/local";
import "./globals.css";
import { contact } from "@/constants/contact";
import { ConsentManager } from "./components/consent-manager";
import { AuthProvider } from "./components/auth-provider";

const jedira = localFont({
  src: [
    {
      path: "../public/fonts/Jedira-Regular.woff2",
      weight: "400",
      style: "normal",
    },
  ],
  variable: "--font-jedira",
  display: "swap",
});

const dmSans = localFont({
  src: [
    {
      path: "../public/fonts/DMSans-Light.woff2",
      weight: "300",
      style: "normal",
    },
    {
      path: "../public/fonts/DMSans-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../public/fonts/DMSans-Medium.woff2",
      weight: "500",
      style: "normal",
    },
  ],
  variable: "--font-dm-sans",
  display: "swap",
});

const siteUrl =
  process.env.NEXT_PUBLIC_APP_URL ?? `https://${contact.domain}`;

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";
  const locale = pathname.startsWith("/es") ? "es" : "en";

  return {
    metadataBase: new URL(siteUrl),
    title: {
      default: "Essentia — Longevity Center & Social Wellness Club in Tenerife",
      template: "%s | Essentia",
    },
    description:
      "Longevity center & social wellness club in Tenerife. Science-backed protocols, medical therapies, and an exclusive community for a longer life.",
    alternates: {
      canonical: pathname,
    },
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
          url: `${siteUrl}/images/logo-for-google.png`,
        },
        address: {
          "@type": "PostalAddress",
          streetAddress: "Baobab Suites",
          addressLocality: "Costa Adeje",
          addressRegion: "Tenerife",
          postalCode: "38660",
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
        image: `${siteUrl}/images/logo-for-google.png`,
        url: siteUrl,
        telephone: contact.phone,
        email: contact.email,
        address: {
          "@type": "PostalAddress",
          streetAddress: "Baobab Suites",
          addressLocality: "Costa Adeje",
          addressRegion: "Tenerife",
          postalCode: "38660",
          addressCountry: "ES",
        },
        geo: {
          "@type": "GeoCoordinates",
          latitude: "28.0863",
          longitude: "-16.7307",
        },
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

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";
  const locale = pathname.startsWith("/es") ? "es" : "en";
  const schemaOrg = buildSchemaOrg(locale);
  return (
    <html lang={locale} data-scroll-behavior="smooth" className={`${jedira.variable} ${dmSans.variable}`}>
      <head>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(schemaOrg) }}
        />
      </head>
      <body className="antialiased">
        <AuthProvider>
          <ConsentManager>{children}</ConsentManager>
        </AuthProvider>
      </body>
    </html>
  );
}
