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

const siteUrl = `https://${contact.domain}`;

export async function generateMetadata(): Promise<Metadata> {
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") ?? "/";

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
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${jedira.variable} ${dmSans.variable}`}>
      <body className="antialiased">
        <AuthProvider>
          <ConsentManager>{children}</ConsentManager>
        </AuthProvider>
      </body>
    </html>
  );
}
