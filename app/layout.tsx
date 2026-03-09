import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { Header } from "./components/header";
import { Footer } from "./components/footer";

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

export const metadata: Metadata = {
  title: "Essentia Massage Therapy",
  description: "Essentia Massage Therapy",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={`${jedira.variable} ${dmSans.variable} antialiased`}>
        <Header />
        <main>{children}</main>
        <Footer />
      </body>
    </html>
  );
}
